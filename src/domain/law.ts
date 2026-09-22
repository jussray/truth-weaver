/**
 * COUNSEL domain rules.
 *
 * Foundational invariant: governing law is the authority. Model output,
 * summaries, books, blogs, vendor pages, user preference and confidence never
 * outrank governing law. These rules are pure functions so the guard can be
 * tested without the UI or the database.
 */

export const TRUTH_STATES = [
  "VERIFIED LAW",
  "SUPPORTED",
  "ALLEGED FACT",
  "INFERRED",
  "CONTRADICTED",
  "STALE",
  "JURISDICTION UNKNOWN",
  "UNVERIFIED LAW",
  "NOT APPLICABLE",
] as const;

export type TruthState = (typeof TRUTH_STATES)[number];

export const TRUTH_STATE_MEANING: Record<TruthState, string> = {
  "VERIFIED LAW": "Primary law located, jurisdiction resolved, citation recorded, official status known, currentness checked.",
  SUPPORTED: "Backed by sources, but not established as governing law.",
  "ALLEGED FACT": "Asserted by a party. Not law, not yet evidenced.",
  INFERRED: "Reasoning-derived. Carries no legal authority on its own.",
  CONTRADICTED: "Contrary authority or evidence is on the record.",
  STALE: "Was supported once; currentness has lapsed or as-of date has passed.",
  "JURISDICTION UNKNOWN": "Governing jurisdiction is unresolved. Fails closed.",
  "UNVERIFIED LAW": "Stated as law without qualifying primary-law evidence.",
  "NOT APPLICABLE": "Out of scope for this issue as framed.",
};

/** Source roles. Authority weight itself is stored per jurisdiction and source. */
export const SOURCE_ROLES = ["primary", "secondary", "discovery"] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

/**
 * Source classes a governing system may treat as primary law. This is a list of
 * candidate classes, NOT a universal hierarchy. Precedential weight is stored
 * per jurisdiction and per source in `legal_sources.authority_weight`.
 */
export const PRIMARY_LAW_SOURCE_TYPES = [
  "constitution",
  "statute_code",
  "enacted_act",
  "regulation",
  "gazette",
  "judicial_decision",
  "treaty",
  "ordinance",
  "court_rule",
  "administrative_order",
  "jurisdiction_defined_authority",
] as const;

export const SECONDARY_SOURCE_TYPES = [
  "treatise",
  "hornbook",
  "practice_guide",
  "restatement",
  "encyclopedia",
  "law_review",
  "commentary",
  "historical",
  "book",
] as const;

export const SOURCE_TYPES = [
  ...PRIMARY_LAW_SOURCE_TYPES,
  ...SECONDARY_SOURCE_TYPES,
  "research_guide",
  "digital_collection",
  "source_family",
  "other",
] as const;

export const JURISDICTION_LAYERS = [
  "international",
  "supranational",
  "country",
  "state",
  "territory",
  "tribal",
  "county",
  "municipal",
  "court",
  "custom",
] as const;
export type JurisdictionLayer = (typeof JURISDICTION_LAYERS)[number];

export const INTEGRATION_STATUSES = [
  "implemented_adapter",
  "linked_source_family",
  "not_yet_integrated",
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const INTEGRATION_STATUS_LABEL: Record<IntegrationStatus, string> = {
  implemented_adapter: "IMPLEMENTED SOURCE ADAPTER",
  linked_source_family: "LINKED SOURCE FAMILY",
  not_yet_integrated: "NOT YET INTEGRATED",
};

export const LEGAL_AREAS = [
  "constitutional", "criminal", "civil procedure", "contracts", "torts",
  "property / land", "housing / landlord-tenant", "family", "juvenile",
  "probate / estates", "tax", "employment / labor", "business / corporate",
  "securities", "antitrust", "consumer", "credit / debt", "bankruptcy",
  "administrative", "immigration", "intellectual property", "privacy / data",
  "cyber", "education", "health", "environmental", "energy", "transportation",
  "insurance", "benefits", "municipal / local government", "tribal / Indigenous",
  "international", "human rights", "military", "maritime / admiralty",
  "election", "evidence", "appellate", "remedies", "other / custom",
] as const;

export type AuthorityClass = "PRIMARY LAW" | "SECONDARY" | "DISCOVERY";

export type SourceLike = {
  id?: string;
  source_type: string;
  source_role: string;
  is_official?: boolean | null;
  is_authentic?: boolean | null;
  jurisdiction_id?: string | null;
};

/** A source counts as primary law only if its role AND its class both say so. */
export function isPrimaryLaw(source: SourceLike): boolean {
  return (
    source.source_role === "primary" &&
    (PRIMARY_LAW_SOURCE_TYPES as readonly string[]).includes(source.source_type)
  );
}

export function classifyAuthority(source: SourceLike): AuthorityClass {
  if (isPrimaryLaw(source)) return "PRIMARY LAW";
  if (source.source_role === "discovery") return "DISCOVERY";
  return "SECONDARY";
}

export type FindingContext = {
  jurisdictionId: string | null | undefined;
  sources: SourceLike[];
  contrarySources?: SourceLike[];
  citation?: string | null;
  /** Whether the official / authentic status of the primary source is known. */
  officialStatusKnown?: boolean;
  currentnessCheckedAt?: string | null;
  asOfDate?: string | null;
  now?: Date;
};

export type GuardResult = {
  allowed: boolean;
  /** State the finding is forced to when VERIFIED LAW is not earned. */
  resolvedState: TruthState;
  blockers: string[];
};

/**
 * The VERIFIED LAW guard. A finding reaches VERIFIED LAW only when a qualifying
 * primary source is present, the jurisdiction is resolved, a citation exists,
 * official/authentic status is known, and currentness has been checked.
 * A secondary or discovery source alone can never produce VERIFIED LAW.
 */
export function evaluateVerifiedLaw(ctx: FindingContext): GuardResult {
  const blockers: string[] = [];
  const primary = ctx.sources.filter(isPrimaryLaw);

  if (!ctx.jurisdictionId) blockers.push("Jurisdiction is unresolved.");
  if (primary.length === 0) blockers.push("No qualifying primary-law source is attached.");
  if (!ctx.citation || ctx.citation.trim() === "") blockers.push("No citation or official identifier recorded.");
  if (ctx.officialStatusKnown !== true) blockers.push("Official / authentic status of the primary source is not known.");
  if (!ctx.currentnessCheckedAt) blockers.push("Currentness / as-of status has not been checked.");

  if (blockers.length === 0) {
    return { allowed: true, resolvedState: "VERIFIED LAW", blockers: [] };
  }

  let resolvedState: TruthState;
  if (!ctx.jurisdictionId) {
    resolvedState = "JURISDICTION UNKNOWN";
  } else if (primary.length === 0) {
    resolvedState = ctx.sources.length > 0 ? "SUPPORTED" : "UNVERIFIED LAW";
  } else {
    resolvedState = "UNVERIFIED LAW";
  }

  return { allowed: false, resolvedState, blockers };
}

/**
 * Applies the guard to a requested truth state. Any state other than
 * VERIFIED LAW passes through unchanged; VERIFIED LAW must be earned.
 */
export function resolveTruthState(requested: TruthState, ctx: FindingContext): GuardResult {
  if (requested !== "VERIFIED LAW") {
    return { allowed: true, resolvedState: requested, blockers: [] };
  }
  return evaluateVerifiedLaw(ctx);
}

export const RED_TEAM_CATEGORIES = [
  { category: "contrary_authority", prompt: "What contrary or conflicting authority exists in this jurisdiction?" },
  { category: "jurisdiction_problem", prompt: "Is the jurisdiction wrong, unresolved, or is another layer controlling?" },
  { category: "superseding_law", prompt: "Has the cited law been amended, repealed, preempted or superseded?" },
  { category: "exception", prompt: "What statutory or judicial exception removes this position from the rule?" },
  { category: "procedural_bar", prompt: "What procedural bar applies: limitations, exhaustion, standing, immunity, notice, forum?" },
  { category: "missing_element", prompt: "Which required element currently has no evidence behind it?" },
  { category: "currentness", prompt: "Is the as-of date correct, and was the source checked for currentness?" },
  { category: "authenticity", prompt: "Is the text official / authentic, or a secondary reproduction?" },
] as const;

export const WORKFLOW_STEPS = [
  "ISSUE", "FACTS", "JURISDICTION", "GOVERNING LAW", "ELEMENTS / RULES",
  "EVIDENCE", "REMEDIES & DEFENSES", "PROCEDURE & DEADLINES",
  "CONTRARY AUTHORITY", "OPTIONS",
] as const;
