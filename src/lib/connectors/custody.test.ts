import { describe, expect, it } from "vitest";

import {
  CANONICALIZATION,
  canonicalizeJson,
  createAuthorizedCommand,
  mintEvidenceEnvelope,
  mintReceipt,
  reconcileCustody,
  type AuthorityDecision,
} from "./custody";

const bodyA = { title: "MCP authorization", score: 1, source: { provider: "exa", tags: ["security", "oauth"] } } as const;

async function fixture() {
  const envelope = await mintEvidenceEnvelope({
    evidenceId: "evd_test_001",
    correlationId: "cor_test_001",
    sourceReference: "https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations",
    recordedAt: "2026-10-02T00:00:00Z",
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

describe("custody canonicalization", () => {
  it("is deterministic across object key order and records a named version", async () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(canonicalizeJson(a)).toBe(canonicalizeJson(b));
    const { envelope } = await fixture();
    expect(envelope.canonicalization).toBe(CANONICALIZATION);
    expect(envelope.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(envelope.authority).toEqual({ canMutate: false, grants: [] });
  });
});

describe("non-transferable authority", () => {
  it("binds a command to the exact provider, operation, target, evidence and correlation", async () => {
    const { command } = await fixture();
    expect(command.provider).toBe("linear");
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

  it("rejects provider/operation transfer and expired authority", async () => {
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
    ).rejects.toThrow();

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

  it("derives the same idempotency key for an authorized retry", async () => {
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
  it("verifies only a receipt that matches the provider read-back", async () => {
    const { envelope, command } = await fixture();
    const receipt = await mintReceipt({
      receiptId: "rcpt_test_001",
      evidenceId: envelope.evidenceId,
      contentHash: envelope.contentHash,
      correlationId: envelope.correlationId,
      authorityDecisionId: command.authorityDecisionId,
      operation: command.operation,
      adapterIdentity: "linear-adapter@1.0.0",
      externalObjectId: "ENG-TEST-1",
      providerTimestamp: "2026-10-02T00:05:01Z",
      readBackVerifiedAt: "2026-10-02T00:05:02Z",
      canonicalization: CANONICALIZATION,
      status: "verified",
    });

    const result = await reconcileCustody({
      envelope,
      command,
      receipt,
      readBack: {
        externalObjectId: "ENG-TEST-1",
        evidenceId: envelope.evidenceId,
        contentHash: envelope.contentHash,
        correlationId: envelope.correlationId,
        operation: command.operation,
      },
    });
    expect(result.status).toBe("VERIFIED");
  });

  it("blocks promotion when the provider read-back disagrees", async () => {
    const { envelope, command } = await fixture();
    const receipt = await mintReceipt({
      receiptId: "rcpt_test_002",
      evidenceId: envelope.evidenceId,
      contentHash: envelope.contentHash,
      correlationId: envelope.correlationId,
      authorityDecisionId: command.authorityDecisionId,
      operation: command.operation,
      adapterIdentity: "linear-adapter@1.0.0",
      externalObjectId: "ENG-TEST-1",
      providerTimestamp: "2026-10-02T00:05:01Z",
      readBackVerifiedAt: "2026-10-02T00:05:02Z",
      canonicalization: CANONICALIZATION,
      status: "verified",
    });

    const result = await reconcileCustody({
      envelope,
      command,
      receipt,
      readBack: {
        externalObjectId: "ENG-TEST-2",
        evidenceId: envelope.evidenceId,
        contentHash: envelope.contentHash,
        correlationId: envelope.correlationId,
        operation: command.operation,
      },
    });
    expect(result).toMatchObject({ status: "UNVERIFIED", next: "RECONCILIATION_REQUIRED", promotion: "BLOCKED" });
  });

  it("detects evidence and receipt tampering", async () => {
    const { envelope, command } = await fixture();
    const receipt = await mintReceipt({
      receiptId: "rcpt_test_003",
      evidenceId: envelope.evidenceId,
      contentHash: envelope.contentHash,
      correlationId: envelope.correlationId,
      authorityDecisionId: command.authorityDecisionId,
      operation: command.operation,
      adapterIdentity: "linear-adapter@1.0.0",
      externalObjectId: "ENG-TEST-1",
      providerTimestamp: "2026-10-02T00:05:01Z",
      readBackVerifiedAt: "2026-10-02T00:05:02Z",
      canonicalization: CANONICALIZATION,
      status: "verified",
    });

    const tamperedEnvelope = { ...envelope, body: { changed: true } };
    const evidenceResult = await reconcileCustody({
      envelope: tamperedEnvelope,
      command,
      receipt,
      readBack: {
        externalObjectId: "ENG-TEST-1",
        evidenceId: envelope.evidenceId,
        contentHash: envelope.contentHash,
        correlationId: envelope.correlationId,
        operation: command.operation,
      },
    });
    expect(evidenceResult).toMatchObject({ status: "UNVERIFIED", promotion: "BLOCKED" });

    const receiptResult = await reconcileCustody({
      envelope,
      command,
      receipt: { ...receipt, adapterIdentity: "linear-adapter@9.9.9" },
      readBack: {
        externalObjectId: "ENG-TEST-1",
        evidenceId: envelope.evidenceId,
        contentHash: envelope.contentHash,
        correlationId: envelope.correlationId,
        operation: command.operation,
      },
    });
    expect(receiptResult).toMatchObject({ status: "UNVERIFIED", reason: "receipt hash mismatch", promotion: "BLOCKED" });
  });
});
