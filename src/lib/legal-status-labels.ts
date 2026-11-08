/** Display labels only. Never use these strings to evaluate or promote authority. */
export const LEGAL_STATUS_LABELS: Readonly<Record<string, string>> = {
  "VERIFIED LAW": "Verified law",
  SUPPORTED: "Supported by sources — not verified law",
  "ALLEGED FACT": "Reported fact — not confirmed",
  INFERRED: "Possible explanation — not confirmed",
  CONTRADICTED: "Conflicting evidence found",
  STALE: "May be out of date",
  "JURISDICTION UNKNOWN": "Location needs checking",
  "UNVERIFIED LAW": "Law not verified",
  "NOT APPLICABLE": "Does not apply",
  "NON-AUTHORIZING": "Research only — not permission to act",
  VERIFIED_SOURCES: "Some law verified — check each finding",
  PARTIAL: "Research incomplete",
  BLOCKED: "Research could not be completed",
  LIVE_RETRIEVAL_UNAVAILABLE: "Official sources could not be retrieved",
};

export function legalStatusLabel(state: string): string {
  return LEGAL_STATUS_LABELS[state] ?? `Not confirmed (${state})`;
}