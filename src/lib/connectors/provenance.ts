import type { TruthState } from "@/domain/law";

/**
 * Provider-neutral provenance. Every connector result must carry one of these.
 * Connector output can contribute evidence but can never, by itself, become
 * VERIFIED LAW — that state is earned only through the law guard in
 * src/domain/law.ts with a qualifying primary source.
 */
export const PROVIDER_IDS = [
  "shopify",
  "github",
  "openai",
  "anthropic",
  "perplexity",
  "gemini",
  "muse",
  "exa",
  "notion",
  "linear",
  "slack",
  "web",
  "x",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const EVIDENCE_TYPES = [
  "primary_law",
  "secondary_commentary",
  "discovery",
  "web_page",
  "ai_generated",
  "commerce_listing",
  "code_repository",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const AI_PROVIDERS: readonly ProviderId[] = ["openai", "anthropic", "gemini", "muse", "perplexity"];

/** States a connector result may carry. VERIFIED LAW is intentionally absent. */
export type ConnectorVerification = Exclude<TruthState, "VERIFIED LAW">;

export type Provenance = {
  provider: ProviderId;
  sourceUrl: string | null;
  immutableId: string | null;
  retrievedAt: string;
  jurisdiction: string | null;
  scope: string | null;
  evidenceType: EvidenceType;
  verification: ConnectorVerification;
  /** Primary-source URLs/IDs that back an AI answer, if any. */
  backedBy: string[];
  notes: string[];
};

export type ProvenanceInput = {
  provider: ProviderId;
  sourceUrl?: string | null;
  immutableId?: string | null;
  retrievedAt?: string | Date;
  jurisdiction?: string | null;
  scope?: string | null;
  evidenceType: EvidenceType;
  requestedVerification?: TruthState;
  backedBy?: string[];
};

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function createProvenance(input: ProvenanceInput, now: Date = new Date()): Provenance {
  const notes: string[] = [];
  const retrieved =
    input.retrievedAt instanceof Date
      ? input.retrievedAt
      : input.retrievedAt
        ? new Date(input.retrievedAt)
        : now;
  if (Number.isNaN(retrieved.getTime())) throw new Error("retrievedAt must be a valid timestamp");

  const sourceUrl = input.sourceUrl && isHttpUrl(input.sourceUrl) ? input.sourceUrl : null;
  if (input.sourceUrl && !sourceUrl) notes.push("Source URL rejected: not an http(s) URL.");
  const immutableId = input.immutableId?.trim() || null;
  const jurisdiction = input.jurisdiction?.trim() || null;
  const backedBy = (input.backedBy ?? []).filter(Boolean);

  const isAi = AI_PROVIDERS.includes(input.provider);
  const evidenceType: EvidenceType = isAi ? "ai_generated" : input.evidenceType;
  if (isAi && input.evidenceType !== "ai_generated") {
    notes.push("AI provider output is always labelled generated, whatever type was requested.");
  }

  let verification: ConnectorVerification;
  const requested = input.requestedVerification ?? "UNVERIFIED LAW";
  if (requested === "VERIFIED LAW") {
    notes.push("VERIFIED LAW cannot come from a connector; it requires the primary-law guard.");
  }

  if (isAi) {
    verification = backedBy.length > 0 ? "SUPPORTED" : "INFERRED";
  } else if (evidenceType === "primary_law" && !jurisdiction) {
    verification = "JURISDICTION UNKNOWN";
  } else if (!sourceUrl && !immutableId) {
    verification = "UNVERIFIED LAW";
    notes.push("No source URL or immutable ID: cannot be traced.");
  } else if (requested === "VERIFIED LAW") {
    verification = evidenceType === "primary_law" ? "SUPPORTED" : "UNVERIFIED LAW";
  } else {
    verification = requested;
  }

  return {
    provider: input.provider,
    sourceUrl,
    immutableId,
    retrievedAt: retrieved.toISOString(),
    jurisdiction,
    scope: input.scope?.trim() || null,
    evidenceType,
    verification,
    backedBy,
    notes,
  };
}

/** Same item from same provider/source collapses to one key (idempotent ingestion). */
export function provenanceKey(p: Provenance) {
  return [p.provider, p.immutableId ?? p.sourceUrl ?? "untraced", p.jurisdiction ?? "-"].join("|");
}
