export const CANONICALIZATION = "juss-json-c14n-v1" as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type EvidenceEnvelope = {
  evidenceId: string;
  origin: "truth-os";
  source: {
    provider: "exa";
    reference: string;
  };
  operation: "exa.discovery.record";
  canonicalization: typeof CANONICALIZATION;
  contentHash: `sha256:${string}`;
  correlationId: string;
  recordedAt: string;
  body: JsonValue;
  authority: {
    canMutate: false;
    grants: readonly [];
  };
};

export type AuthorityDecision = {
  authorityDecisionId: string;
  provider: "notion" | "linear" | "slack";
  operation: string;
  target: Record<string, string>;
  evidenceId: string;
  correlationId: string;
  scope: string[];
  issuedAt: string;
  expiresAt: string;
  commandNonce: string;
  status: "approved" | "rejected";
};

export type AuthorizedCommand = {
  commandId: string;
  evidenceId: string;
  contentHash: `sha256:${string}`;
  correlationId: string;
  provider: AuthorityDecision["provider"];
  operation: string;
  target: Record<string, string>;
  authorityDecisionId: string;
  commandNonce: string;
  idempotencyKey: `sha256:${string}`;
};

export type ProviderReceipt = {
  receiptId: string;
  evidenceId: string;
  contentHash: `sha256:${string}`;
  correlationId: string;
  authorityDecisionId: string;
  operation: string;
  adapterIdentity: string;
  externalObjectId: string;
  providerTimestamp: string;
  readBackVerifiedAt: string;
  canonicalization: typeof CANONICALIZATION;
  receiptHash: `sha256:${string}`;
  status: "verified";
};

export type ReconciliationResult =
  | { status: "VERIFIED"; receiptId: string; externalObjectId: string }
  | { status: "UNVERIFIED"; reason: string; next: "RECONCILIATION_REQUIRED"; promotion: "BLOCKED" };

function assertFiniteNumber(value: number) {
  if (!Number.isFinite(value)) throw new Error("canonical JSON forbids non-finite numbers");
  if (Object.is(value, -0)) return 0;
  return value;
}

/**
 * juss-json-c14n-v1
 * - object keys sorted lexicographically by Unicode code point
 * - arrays preserve order
 * - undefined/functions/symbols are rejected
 * - finite numbers use ECMAScript JSON serialization
 * - strings are serialized by JSON.stringify without Unicode normalization
 *
 * This is versioned explicitly and is NOT represented as RFC 8785/JCS.
 */
export function canonicalizeJson(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(assertFiniteNumber(value));
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key] as JsonValue)}`).join(",")}}`;
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

export async function mintEvidenceEnvelope(input: {
  evidenceId: string;
  correlationId: string;
  sourceReference: string;
  recordedAt: string;
  body: JsonValue;
}): Promise<EvidenceEnvelope> {
  requireIsoTimestamp(input.recordedAt, "recordedAt");
  if (!input.evidenceId.startsWith("evd_")) throw new Error("evidenceId must be OS-minted (evd_)");
  if (!input.correlationId.startsWith("cor_")) throw new Error("correlationId must be OS-minted (cor_)");
  if (!input.sourceReference.trim()) throw new Error("sourceReference is required");

  return {
    evidenceId: input.evidenceId,
    origin: "truth-os",
    source: { provider: "exa", reference: input.sourceReference },
    operation: "exa.discovery.record",
    canonicalization: CANONICALIZATION,
    contentHash: await sha256Canonical(input.body),
    correlationId: input.correlationId,
    recordedAt: new Date(input.recordedAt).toISOString(),
    body: input.body,
    authority: { canMutate: false, grants: [] },
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

  const idempotencyKey = await sha256Canonical({
    evidenceId: input.envelope.evidenceId,
    correlationId: input.envelope.correlationId,
    provider: input.provider,
    operation: input.operation,
    target: input.target,
    authorityDecisionId: input.decision.authorityDecisionId,
    commandNonce: input.decision.commandNonce,
  });

  return {
    commandId: input.commandId,
    evidenceId: input.envelope.evidenceId,
    contentHash: input.envelope.contentHash,
    correlationId: input.envelope.correlationId,
    provider: input.provider,
    operation: input.operation,
    target: input.target,
    authorityDecisionId: input.decision.authorityDecisionId,
    commandNonce: input.decision.commandNonce,
    idempotencyKey,
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
  command: AuthorizedCommand;
  receipt: ProviderReceipt;
  readBack: {
    externalObjectId: string;
    evidenceId: string;
    contentHash: `sha256:${string}`;
    correlationId: string;
    operation: string;
  };
}): Promise<ReconciliationResult> {
  const fail = (reason: string): ReconciliationResult => ({
    status: "UNVERIFIED",
    reason,
    next: "RECONCILIATION_REQUIRED",
    promotion: "BLOCKED",
  });

  const expectedEvidenceHash = await sha256Canonical(input.envelope.body);
  if (expectedEvidenceHash !== input.envelope.contentHash) return fail("evidence body hash mismatch");

  const { command, receipt, readBack, envelope } = input;
  if (command.evidenceId !== envelope.evidenceId || receipt.evidenceId !== envelope.evidenceId || readBack.evidenceId !== envelope.evidenceId) {
    return fail("evidence identity mismatch");
  }
  if (command.contentHash !== envelope.contentHash || receipt.contentHash !== envelope.contentHash || readBack.contentHash !== envelope.contentHash) {
    return fail("content hash mismatch");
  }
  if (command.correlationId !== envelope.correlationId || receipt.correlationId !== envelope.correlationId || readBack.correlationId !== envelope.correlationId) {
    return fail("correlation mismatch");
  }
  if (receipt.authorityDecisionId !== command.authorityDecisionId) return fail("authority decision mismatch");
  if (receipt.operation !== command.operation || readBack.operation !== command.operation) return fail("operation mismatch");
  if (receipt.externalObjectId !== readBack.externalObjectId) return fail("provider object mismatch");

  const { receiptHash, ...receiptBody } = receipt;
  const expectedReceiptHash = await sha256Canonical(receiptBody as unknown as JsonValue);
  if (receiptHash !== expectedReceiptHash) return fail("receipt hash mismatch");

  return { status: "VERIFIED", receiptId: receipt.receiptId, externalObjectId: receipt.externalObjectId };
}
