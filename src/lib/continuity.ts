export const CONTINUITY_COOKIE_NAME = "tw_continuity_v1";

export type ContinuityFreshness = "FRESH" | "STALE" | "UNBOUND";

export type ResearchFingerprintEvidence = {
  repo: "jussray/truth-weaver";
  branch: "main";
  codeVersion: string;
  researchVersion: string;
  normalizedQuestionHash: string;
  jurisdiction: string[];
  eventDate: string | null;
  asOfDate: string | null;
  sourceEvidence: Array<{
    url: string;
    citation: string | null;
    sourceType: string;
    authorityClass: string;
    retrievedAt: string | null;
    currentnessEvidence: string | null;
  }>;
  findingStates: string[];
};

export type ContinuityMarker = {
  schema: "truth-weaver.continuity.v1";
  fingerprint: string;
  authority: "EVIDENCE_ONLY";
  authorizing: false;
  freshness: ContinuityFreshness;
  createdAt: string;
  predecessor: string | null;
  staleReason: string | null;
};

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)]),
    );
  }
  return typeof value === "string" ? value.trim() : value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashSensitiveText(value: string): Promise<string> {
  return sha256Hex(value.trim().replace(/\s+/g, " ").toLowerCase());
}

export async function fingerprintResearchEvidence(
  evidence: ResearchFingerprintEvidence,
): Promise<string> {
  return sha256Hex(canonicalJson(evidence));
}

export async function createContinuityMarker(
  evidence: ResearchFingerprintEvidence,
  options: {
    predecessor?: string | null;
    createdAt?: string;
  } = {},
): Promise<ContinuityMarker> {
  const fingerprint = await fingerprintResearchEvidence(evidence);
  return {
    schema: "truth-weaver.continuity.v1",
    fingerprint,
    authority: "EVIDENCE_ONLY",
    authorizing: false,
    freshness: evidence.codeVersion === "runtime-unbound" ? "UNBOUND" : "FRESH",
    createdAt: options.createdAt ?? new Date().toISOString(),
    predecessor: options.predecessor ?? null,
    staleReason: evidence.codeVersion === "runtime-unbound" ? "Runtime code version is not bound." : null,
  };
}

export function compareContinuity(
  previous: ContinuityMarker | null,
  current: ContinuityMarker,
): ContinuityMarker {
  if (!previous) return current;
  if (previous.fingerprint === current.fingerprint) return current;
  return {
    ...previous,
    freshness: "STALE",
    staleReason: "Material research evidence changed. STALE != FALSE.",
  };
}

export function serializeContinuityCookie(marker: ContinuityMarker): string {
  const minimal = {
    f: marker.fingerprint,
    c: marker.createdAt,
    p: marker.predecessor,
    s: marker.freshness,
    a: "EVIDENCE_ONLY",
  };
  return encodeURIComponent(JSON.stringify(minimal));
}

export function writeContinuityCookie(marker: ContinuityMarker): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    CONTINUITY_COOKIE_NAME +
    "=" +
    serializeContinuityCookie(marker) +
    "; Path=/; Max-Age=2592000; SameSite=Lax" +
    secure;
}
