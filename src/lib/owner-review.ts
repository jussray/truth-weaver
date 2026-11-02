/** Pure, privacy-conscious schemas for the two founder-only features. */
export type EvidenceItem = { description: string; sourceUrl?: string };
export type ClaimInput = { claim: string; evidence: EvidenceItem[] };
export type NextGate = 'COLLECT_EVIDENCE' | 'CHALLENGE' | 'HUMAN_REVIEW' | 'HOLD';
export type EvidenceReview = {
  evidenceGaps: string[];
  attackQuestions: string[];
  nextGate: NextGate;
  gateReason: string;
  limitations: string[];
};
const gates: NextGate[] = ['COLLECT_EVIDENCE', 'CHALLENGE', 'HUMAN_REVIEW', 'HOLD'];
const text = (v: unknown, max: number, label: string) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(`${label} must be 1–${max} characters.`);
  return v.trim();
};
export function validateClaimInput(value: unknown): ClaimInput {
  if (!value || typeof value !== 'object') throw new Error('A claim and supporting evidence are required.');
  const v = value as Record<string, unknown>;
  const claim = text(v.claim, 2500, 'Claim');
  if (!Array.isArray(v.evidence) || v.evidence.length > 10) throw new Error('Provide up to ten evidence items.');
  const evidence = v.evidence.map((entry, i) => {
    if (!entry || typeof entry !== 'object') throw new Error('Evidence item is invalid.');
    const e = entry as Record<string, unknown>;
    const description = text(e.description, 1500, `Evidence ${i + 1}`);
    let sourceUrl: string | undefined;
    if (e.sourceUrl != null && e.sourceUrl !== '') {
      if (typeof e.sourceUrl !== 'string' || e.sourceUrl.length > 2048) throw new Error('Source URL is invalid.');
      try {
        const u = new URL(e.sourceUrl);
        if (u.protocol !== 'https:' || u.username || u.password) throw new Error('invalid');
        sourceUrl = u.toString();
      } catch { throw new Error('Source URL must be an HTTPS URL without credentials.'); }
    }
    return { description, ...(sourceUrl ? { sourceUrl } : {}) };
  });
  return { claim, evidence };
}
function strings(v: unknown, label: string): string[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 7) throw new Error(`${label}: invalid number of items.`);
  return v.map((s) => text(s, 400, label));
}
export function parseEvidenceReview(raw: string): EvidenceReview {
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()); }
  catch { throw new Error('AI response was not valid JSON.'); }
  if (!value || typeof value !== 'object') throw new Error('AI response was not a review.');
  const o = value as Record<string, unknown>;
  if (!gates.includes(o.nextGate as NextGate)) throw new Error('AI selected an unsupported gate.');
  return {
    evidenceGaps: strings(o.evidenceGaps, 'Evidence gaps'),
    attackQuestions: strings(o.attackQuestions, 'Attack questions'),
    nextGate: o.nextGate as NextGate,
    gateReason: text(o.gateReason, 500, 'Gate reason'),
    limitations: strings(o.limitations, 'Limitations'),
  };
}
export type SitemapStatus = { url: string; pending: boolean; submitted: string | null; downloaded: string | null; errors: number; warnings: number; submittedUrls: number | null };
export type InspectionStatus = { url: string; verdict: string; coverage: string; indexing: string; fetch: string; lastCrawl: string | null; googleCanonical: string | null; indexed: boolean | null; error?: string };
export const CANONICAL_PATHS = ['/', '/notice-analyzer', '/connectors', '/sources', '/legal-library', '/shop'] as const;
export const SITE_ORIGIN = 'https://truthweaver.jussco.company';
export const PUBLIC_URLS = CANONICAL_PATHS.map((p) => `${SITE_ORIGIN}${p}`);
function count(value: unknown): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
export function normalizeSitemaps(data: unknown): SitemapStatus[] {
  const entries = (data as { sitemap?: unknown })?.sitemap;
  if (!Array.isArray(entries)) return [];
  return entries.filter((v) => v && typeof v.path === 'string' && v.path.startsWith('https://')).slice(0, 50).map((v) => ({
    url: v.path,
    pending: v.isPending === true,
    submitted: typeof v.lastSubmitted === 'string' ? v.lastSubmitted : null,
    downloaded: typeof v.lastDownloaded === 'string' ? v.lastDownloaded : null,
    errors: count(v.errors),
    warnings: count(v.warnings),
    // Do not read deprecated contents[].indexed or synthesize an indexed count.
    submittedUrls: Array.isArray(v.contents) ? v.contents.filter((c: {type?: string}) => c.type === 'web').reduce((sum: number, c: {submitted?: unknown}) => sum + count(c.submitted), 0) : null,
  }));
}
export function normalizeInspection(url: string, data: unknown): InspectionStatus {
  if (!PUBLIC_URLS.includes(url)) throw new Error('URL is outside the approved sitemap.');
  const x = (data as { inspectionResult?: { indexStatusResult?: Record<string, unknown> } })?.inspectionResult?.indexStatusResult;
  if (!x) throw new Error('Google returned no index status.');
  const verdict = typeof x.verdict === 'string' ? x.verdict : 'UNKNOWN';
  return {
    url, verdict,
    coverage: typeof x.coverageState === 'string' ? x.coverageState : 'Unknown',
    indexing: typeof x.indexingState === 'string' ? x.indexingState : 'Unknown',
    fetch: typeof x.pageFetchState === 'string' ? x.pageFetchState : 'Unknown',
    lastCrawl: typeof x.lastCrawlTime === 'string' ? x.lastCrawlTime : null,
    googleCanonical: typeof x.googleCanonical === 'string' ? x.googleCanonical : null,
    // PASS refers to Google's indexed-version inspection result, not a live indexability test.
    indexed: verdict === 'PASS' ? true : verdict === 'FAIL' || verdict === 'NEUTRAL' ? false : null,
  };
}
