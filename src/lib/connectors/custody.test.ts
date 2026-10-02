import { describe, expect, it } from "vitest";

import {
  CANONICALIZATION,
  canonicalizeJson,
  createAuthorizedCommand,
  mintEvidenceEnvelope,
  mintReceipt,
  reconcileCustody,
  type AuthorityDecision,
  type JsonValue,
  type ProviderReadBack,
} from "./custody";

const bodyA: JsonValue = {
  title: "MCP authorization",
  score: 1,
  source: { provider: "exa", tags: ["security", "oauth"] },
};

async function fixture() {
  const envelope = await mintEvidenceEnvelope({
    evidenceId: "evd_test_001",
    correlationId: "cor_test_001",
    sourceReference: "https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations",
    retrievedAt: "2026-10-02T00:00:00Z",
    recordedAt: "2026-10-02T00:00:01Z",
    body: bodyA,
  });
  const decision: AuthorityDecision = {
    authorityDecisionId: "authz_test_001",
    provider: "linear",
    operation: "linear.issue.create",
    target: { workspaceId: "ws_test", teamId: "team_test", projectId: "project_test" },
    evidenceId: envelope.evidenceId,
    correlationId: envelope.correlationId,
    scope: ["issues:create"],
    issuedAt: "2026-10-02T00:00:00Z",
    expiresAt: "2026-10-02T00:10:00Z",
    commandNonce: "nonce_test_001",
    credentialRef: "credref_linear_test",
    status: "approved",
  };
  const command = await createAuthorizedCommand({
    commandId: "cmd_test_001",
    envelope,
    decision,
    provider: "linear",
    operation: "linear.issue.create",
    target: decision.target,
    now: "2026-10-02T00:05:00Z",
  });
  return { envelope, decision, command };
}

async function verifiedArtifacts() {
  const { envelope, decision, command } = await fixture();
  const receipt = await mintReceipt({
    receiptId: "rcpt_test_001",
    correlationId: envelope.correlationId,
    evidenceId: envelope.evidenceId,
    contentHash: envelope.contentHash,
    commandId: command.commandId,
    authorityDecisionId: command.authorityDecisionId,
    provider: command.provider,
    operation: command.operation,
    targetHash: command.targetHash,
    adapterIdentity: "linear-adapter@1.0.0",
    externalObjectId: "ENG-TEST-1",
    providerTimestamp: "2026-10-02T00:05:01Z",
    readBackVerifiedAt: "2026-10-02T00:05:02Z",
    canonicalization: CANONICALIZATION,
    status: "verified",
  });
  const readBack: ProviderReadBack = {
    externalObjectId: receipt.externalObjectId,
    evidenceId: envelope.evidenceId,
    contentHash: envelope.contentHash,
    correlationId: envelope.correlationId,
    commandId: command.commandId,
    provider: command.provider,
    operation: command.operation,
    targetHash: command.targetHash,
    adapterIdentity: receipt.adapterIdentity,
  };
  return { envelope, decision, command, receipt, readBack };
}

describe("custody canonicalization", () => {
  it("uses deterministic JCS ordering and records the named version", async () => {
    expect(canonicalizeJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(canonicalizeJson({ a: 1, b: 2 })).toBe(canonicalizeJson({ b: 2, a: 1 }));
    const { envelope } = await fixture();
    expect(envelope.canonicalization).toBe("jcs-v1");
    expect(envelope.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects values JCS cannot canonically represent", () => {
    expect(() => canonicalizeJson(Number.POSITIVE_INFINITY)).toThrow("JCS forbids non-finite numbers");
    expect(() => canonicalizeJson("\ud800")).toThrow("JCS forbids lone Unicode surrogates");
  });

  it("keeps authorization completely out of the evidence envelope", async () => {
    const { envelope } = await fixture();
    expect("authority" in envelope).toBe(false);
    expect("authorityDecisionId" in envelope).toBe(false);
    expect("credentialRef" in envelope).toBe(false);
  });
});

describe("non-transferable authority", () => {
  it("binds a command to provider, operation, target, evidence, correlation, scope and opaque credential reference", async () => {
    const { command } = await fixture();
    expect(command.provider).toBe("linear");
    expect(command.scope).toEqual(["issues:create"]);
    expect(command.credentialRef).toBe("credref_linear_test");
    expect(command.targetHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(command.idempotencyKey).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects target substitution before any provider request", async () => {
    const { envelope, decision } = await fixture();
    await expect(
      createAuthorizedCommand({
        commandId: "cmd_bad_target",
        envelope,
        decision,
        provider: "linear",
        operation: "linear.issue.create",
        target: { ...decision.target, teamId: "other_team" },
        now: "2026-10-02T00:05:00Z",
      }),
    ).rejects.toThrow("authority target mismatch");
  });

  it("rejects provider/operation transfer, correlation substitution and expired authority", async () => {
    const { envelope, decision } = await fixture();
    await expect(
      createAuthorizedCommand({
        commandId: "cmd_bad_provider",
        envelope,
        decision,
        provider: "notion",
        operation: "notion.page.update",
        target: decision.target,
        now: "2026-10-02T00:05:00Z",
      }),
    ).rejects.toThrow("authority provider mismatch");

    await expect(
      createAuthorizedCommand({
        commandId: "cmd_bad_correlation",
        envelope,
        decision: { ...decision, correlationId: "cor_other" },
        provider: "linear",
        operation: "linear.issue.create",
        target: decision.target,
        now: "2026-10-02T00:05:00Z",
      }),
    ).rejects.toThrow("authority correlation mismatch");

    await expect(
      createAuthorizedCommand({
        commandId: "cmd_expired",
        envelope,
        decision,
        provider: "linear",
        operation: "linear.issue.create",
        target: decision.target,
        now: "2026-10-02T00:11:00Z",
      }),
    ).rejects.toThrow("authority decision expired");
  });

  it("derives the same idempotency key for the same authorized attempt", async () => {
    const { envelope, decision, command } = await fixture();
    const retry = await createAuthorizedCommand({
      commandId: "cmd_retry",
      envelope,
      decision,
      provider: "linear",
      operation: "linear.issue.create",
      target: decision.target,
      now: "2026-10-02T00:06:00Z",
    });
    expect(retry.idempotencyKey).toBe(command.idempotencyKey);
  });
});

describe("receipt reconciliation", () => {
  it("verifies only a receipt that matches the separately authorized command and provider read-back", async () => {
    const artifacts = await verifiedArtifacts();
    const result = await reconcileCustody(artifacts);
    expect(result).toEqual({ status: "VERIFIED", receiptId: artifacts.receipt.receiptId, externalObjectId: "ENG-TEST-1" });
  });

  it("blocks promotion when the provider read-back disagrees about object, command, target or adapter", async () => {
    const artifacts = await verifiedArtifacts();

    const objectMismatch = await reconcileCustody({
      ...artifacts,
      readBack: { ...artifacts.readBack, externalObjectId: "ENG-TEST-2" },
    });
    expect(objectMismatch).toMatchObject({ status: "UNVERIFIED", reason: "provider object mismatch", promotion: "BLOCKED" });

    const commandMismatch = await reconcileCustody({
      ...artifacts,
      readBack: { ...artifacts.readBack, commandId: "cmd_other" },
    });
    expect(commandMismatch).toMatchObject({ status: "UNVERIFIED", reason: "command identity mismatch", promotion: "BLOCKED" });

    const targetMismatch = await reconcileCustody({
      ...artifacts,
      readBack: { ...artifacts.readBack, targetHash: "sha256:bad" },
    });
    expect(targetMismatch).toMatchObject({ status: "UNVERIFIED", reason: "target binding mismatch", promotion: "BLOCKED" });

    const adapterMismatch = await reconcileCustody({
      ...artifacts,
      readBack: { ...artifacts.readBack, adapterIdentity: "linear-adapter@2.0.0" },
    });
    expect(adapterMismatch).toMatchObject({ status: "UNVERIFIED", reason: "adapter identity mismatch", promotion: "BLOCKED" });
  });

  it("detects evidence and receipt tampering", async () => {
    const artifacts = await verifiedArtifacts();

    const evidenceResult = await reconcileCustody({
      ...artifacts,
      envelope: { ...artifacts.envelope, body: { changed: true } },
    });
    expect(evidenceResult).toMatchObject({ status: "UNVERIFIED", reason: "evidence body hash mismatch", promotion: "BLOCKED" });

    const tamperedReceipt = { ...artifacts.receipt, adapterIdentity: "linear-adapter@9.9.9" };
    const receiptResult = await reconcileCustody({
      ...artifacts,
      receipt: tamperedReceipt,
      readBack: { ...artifacts.readBack, adapterIdentity: tamperedReceipt.adapterIdentity },
    });
    expect(receiptResult).toMatchObject({ status: "UNVERIFIED", reason: "receipt hash mismatch", promotion: "BLOCKED" });
  });

  it("does not let a receipt fill in a missing or mismatched authority decision", async () => {
    const artifacts = await verifiedArtifacts();
    const result = await reconcileCustody({
      ...artifacts,
      decision: { ...artifacts.decision, authorityDecisionId: "authz_missing" },
    });
    expect(result).toMatchObject({
      status: "UNVERIFIED",
      reason: "command authority decision missing or mismatched",
      next: "RECONCILIATION_REQUIRED",
      promotion: "BLOCKED",
    });
  });
});
