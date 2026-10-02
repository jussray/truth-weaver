export const CANONICALIZATION = "jcs-v1" as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type EvidenceEnvelope = {
  evidenceId: string;
  correlationId: string;
  origin: "truth-os";
  source: {
    provider: "exa";
    discoveryRef: string;
    retrievedAt: string;
  };
  canonicalization: typeof CANONICALIZATION;
  contentHash: `sha256:${string}`;
  recordedAt: string;
  body: JsonValue;
};

export type AuthorityDecision = {
  authorityDecisionId: string;
  provider: "notion" | "linear" | "slack";
  operation: string;
  target: Record<string, string>;
  evidenceId: string;
  correlationId: string;
  scope: readonly string[];
  issuedAt: string;
  expiresAt: string;
  commandNonce: string;
  credentialRef: `credref_${string}`;
  status: "approved" | "rejected";
};

export type AuthorizedCommand = {
  commandId: string;
  correlationId: string;
  evidenceId: string;
  contentHash: `sha256:${string}`;
  authorityDecisionId: string;
  provider: AuthorityDecision["provider"];
  operation: string;
  target: Record<string, string>;
  targetHash: `sha256:${string}`;
  scope: readonly string[];
  issuedAt: string;
  expiresAt: string;
  commandNonce: string;
  idempotencyKey: `sha256:${string}`;
  credentialRef: `credref_${string}`;
};

export type ProviderReceipt = {
  receiptId: string;
  correlationId: string;
  evidenceId: string;
  contentHash: `sha256:${string}`;
  commandId: string;
  authorityDecisionId: string;
  provider: AuthorityDecision["provider"];
  operation: string;
  targetHash: `sha256:${string}`;
  adapterIdentity: string;
  externalObjectId: string;
  providerTimestamp: string;
  readBackVerifiedAt: string;
  canonicalization: typeof CANONICALIZATION;
  receiptHash: `sha256:${string}`;
  status: "verified";
};

export type ProviderReadBack = {
  externalObjectId: string;
  evidenceId: string;
  contentHash: `sha256:${string}`;
  correlationId: string;
  commandId: string;
  provider: AuthorityDecision["provider"];
  operation: string;
  targetHash: `sha256:${string}`;
  adapterIdentity: string;
};

export type ReconciliationResult =
  | { status: "VERIFIED"; receiptId: string; externalObjectId: string }
  | { status: "UNVERIFIED"; reason: string; next: "RECONCILIATION_REQUIRED"; promotion: "BLOCKED" };

function assertFiniteNumber(value: number) {
  if (!Number.isFinite(value)) throw new Error("JCS forbids non-finite numbers");
  return value;
}

function assertValidUnicode(value: string) {
  for (let i = 0; i < value.length; i += 1) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("JCS forbids lone Unicode surrogates");
      i += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error("JCS forbids lone Unicode surrogates");
    }
  }
}

/**
 * jcs-v1: RFC 8785 JSON Canonicalization Scheme for the supported JSON domain.
 * - object properties are sorted by ECMAScript/UTF-16 lexical order
 * - arrays preserve order
 * - finite numbers use ECMAScript JSON number serialization
 * - strings use JSON escaping without Unicode normalization
 * - lone Unicode surrogates and non-finite numbers are rejected
 */
export function canonicalizeJson(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(assertFiniteNumber(value));
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;

  const objectValue = value as { readonly [key: string]: JsonValue };
  const keys = Object.keys(objectValue).sort();
  return `{${keys
    .map((key) => {
      assertValidUnicode(key);
      return `${JSON.stringify(key)}:${canonicalizeJson(objectValue[key])}`;
    })
    .join(",")}}`;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Canonical(value: JsonValue): Promise<`sha256:${string}`> {
  const canonical = canonicalizeJson(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return `sha256:${bytesToHex(digest)}`;
}

function requireIsoTimestamp(value: string, name: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${name} must be a valid timestamp`);
  return parsed;
}

function sameTarget(a: Record<string, string>, b: Record<string, string>) {
  return canonicalizeJson(a as JsonValue) === canonicalizeJson(b as JsonValue);
}

function normalizedScope(scope: readonly string[]) {
  const normalized = Array.from(new Set(scope.map((item) => item.trim()).filter(Boolean))).sort();
  if (normalized.length === 0) throw new Error("authority scope required");
  return normalized;
}

export async function mintEvidenceEnvelope(input: {
  evidenceId: string;
  correlationId: string;
  sourceReference: string;
  retrievedAt: string;
  recordedAt: string;
  body: JsonValue;
}): Promise<EvidenceEnvelope> {
  requireIsoTimestamp(input.retrievedAt, "retrievedAt");
  requireIsoTimestamp(input.recordedAt, "recordedAt");
  if (!input.evidenceId.startsWith("evd_")) throw new Error("evidenceId must be OS-minted (evd_)");
  if (!input.correlationId.startsWith("cor_")) throw new Error("correlationId must be OS-minted (cor_)");
  if (!input.sourceReference.trim()) throw new Error("sourceReference is required");

  return {
    evidenceId: input.evidenceId,
    correlationId: input.correlationId,
    origin: "truth-os",
    source: {
      provider: "exa",
      discoveryRef: input.sourceReference,
      retrievedAt: new Date(input.retrievedAt).toISOString(),
    },
    canonicalization: CANONICALIZATION,
    contentHash: await sha256Canonical(input.body),
    recordedAt: new Date(input.recordedAt).toISOString(),
    body: input.body,
  };
}

export function validateAuthorityDecision(input: {
  decision: AuthorityDecision;
  envelope: EvidenceEnvelope;
  provider: AuthorityDecision["provider"];
  operation: string;
  target: Record<string, string>;
  now: string;
}) {
  const { decision, envelope } = input;
  const now = requireIsoTimestamp(input.now, "now");
  const issued = requireIsoTimestamp(decision.issuedAt, "issuedAt");
  const expires = requireIsoTimestamp(decision.expiresAt, "expiresAt");

  if (decision.status !== "approved") throw new Error("authority decision is not approved");
  if (decision.provider !== input.provider) throw new Error("authority provider mismatch");
  if (decision.operation !== input.operation) throw new Error("authority operation mismatch");
  if (!sameTarget(decision.target, input.target)) throw new Error("authority target mismatch");
  if (decision.evidenceId !== envelope.evidenceId) throw new Error("authority evidence mismatch");
  if (decision.correlationId !== envelope.correlationId) throw new Error("authority correlation mismatch");
  if (now < issued) throw new Error("authority decision not active yet");
  if (now > expires) throw new Error("authority decision expired");
  if (!decision.commandNonce.trim()) throw new Error("authority command nonce required");
  if (!decision.credentialRef.startsWith("credref_")) throw new Error("opaque credential reference required");
  normalizedScope(decision.scope);
}

export async function createAuthorizedCommand(input: {
  commandId: string;
  envelope: EvidenceEnvelope;
  decision: AuthorityDecision;
  provider: AuthorityDecision["provider"];
  operation: string;
  target: Record<string, string>;
  now: string;
}): Promise<AuthorizedCommand> {
  validateAuthorityDecision(input);
  const scope = normalizedScope(input.decision.scope);
  const targetHash = await sha256Canonical(input.target as JsonValue);
  const idempotencyKey = await sha256Canonical({
    evidenceId: input.envelope.evidenceId,
    correlationId: input.envelope.correlationId,
    provider: input.provider,
    operation: input.operation,
    targetHash,
    authorityDecisionId: input.decision.authorityDecisionId,
    commandNonce: input.decision.commandNonce,
  });

  return {
    commandId: input.commandId,
    correlationId: input.envelope.correlationId,
    evidenceId: input.envelope.evidenceId,
    contentHash: input.envelope.contentHash,
    authorityDecisionId: input.decision.authorityDecisionId,
    provider: input.provider,
    operation: input.operation,
    target: input.target,
    targetHash,
    scope,
    issuedAt: new Date(input.decision.issuedAt).toISOString(),
    expiresAt: new Date(input.decision.expiresAt).toISOString(),
    commandNonce: input.decision.commandNonce,
    idempotencyKey,
    credentialRef: input.decision.credentialRef,
  };
}

type ReceiptWithoutHash = Omit<ProviderReceipt, "receiptHash">;

export async function mintReceipt(input: ReceiptWithoutHash): Promise<ProviderReceipt> {
  if (!input.adapterIdentity.includes("@")) throw new Error("adapterIdentity must include a version");
  if (!input.externalObjectId.trim()) throw new Error("externalObjectId is required");
  requireIsoTimestamp(input.providerTimestamp, "providerTimestamp");
  requireIsoTimestamp(input.readBackVerifiedAt, "readBackVerifiedAt");

  const receiptHash = await sha256Canonical(input as unknown as JsonValue);
  return { ...input, receiptHash };
}

export async function reconcileCustody(input: {
  envelope: EvidenceEnvelope;
  decision: AuthorityDecision;
  command: AuthorizedCommand;
  receipt: ProviderReceipt;
  readBack: ProviderReadBack;
}): Promise<ReconciliationResult> {
  const fail = (reason: string): ReconciliationResult => ({
    status: "UNVERIFIED",
    reason,
    next: "RECONCILIATION_REQUIRED",
    promotion: "BLOCKED",
  });

  const { envelope, decision, command, receipt, readBack } = input;
  const expectedEvidenceHash = await sha256Canonical(envelope.body);
  if (expectedEvidenceHash !== envelope.contentHash) return fail("evidence body hash mismatch");

  try {
    validateAuthorityDecision({
      decision,
      envelope,
      provider: command.provider,
      operation: command.operation,
      target: command.target,
      now: receipt.providerTimestamp,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "authority decision invalid");
  }

  if (decision.authorityDecisionId !== command.authorityDecisionId) return fail("command authority decision missing or mismatched");
  if (command.evidenceId !== envelope.evidenceId || receipt.evidenceId !== envelope.evidenceId || readBack.evidenceId !== envelope.evidenceId) {
    return fail("evidence identity mismatch");
  }
  if (command.contentHash !== envelope.contentHash || receipt.contentHash !== envelope.contentHash || readBack.contentHash !== envelope.contentHash) {
    return fail("content hash mismatch");
  }
  if (command.correlationId !== envelope.correlationId || receipt.correlationId !== envelope.correlationId || readBack.correlationId !== envelope.correlationId) {
    return fail("correlation mismatch");
  }
  if (receipt.commandId !== command.commandId || readBack.commandId !== command.commandId) return fail("command identity mismatch");
  if (receipt.authorityDecisionId !== command.authorityDecisionId) return fail("authority decision mismatch");
  if (receipt.provider !== command.provider || readBack.provider !== command.provider) return fail("provider mismatch");
  if (receipt.operation !== command.operation || readBack.operation !== command.operation) return fail("operation mismatch");

  const expectedTargetHash = await sha256Canonical(command.target as JsonValue);
  if (expectedTargetHash !== command.targetHash || receipt.targetHash !== command.targetHash || readBack.targetHash !== command.targetHash) {
    return fail("target binding mismatch");
  }
  if (receipt.adapterIdentity !== readBack.adapterIdentity) return fail("adapter identity mismatch");
  if (receipt.externalObjectId !== readBack.externalObjectId) return fail("provider object mismatch");

  const { receiptHash, ...receiptBody } = receipt;
  const expectedReceiptHash = await sha256Canonical(receiptBody as unknown as JsonValue);
  if (receiptHash !== expectedReceiptHash) return fail("receipt hash mismatch");

  return { status: "VERIFIED", receiptId: receipt.receiptId, externalObjectId: receipt.externalObjectId };
}
