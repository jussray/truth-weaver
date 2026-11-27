import { z } from "zod";
import { canonicalUrl, INDEXABLE_PATHS, SITE_URL } from "@/lib/seo";

export const SEARCH_PROPERTY = SITE_URL + "/";
export const SEARCH_SITEMAP = SEARCH_PROPERTY + "sitemap.xml";
export const MONITORED_PAGES: readonly string[] = INDEXABLE_PATHS.map(canonicalUrl);

export const claimReviewInput = z.object({
  claim: z.string().trim().min(12).max(1800),
  evidence: z.array(z.object({
    label: z.string().trim().min(3).max(120),
    detail: z.string().trim().min(10).max(1400),
    url: z.string().trim().url().startsWith("https://").max(400).optional(),
  }).strict()).min(1).max(6),
  consent: z.literal(true),
}).strict();
export type ClaimReviewInput = z.infer<typeof claimReviewInput>;

const reviewSchema = z.object({
  gaps: z.array(z.object({
    issue: z.string().trim().min(3).max(480),
    neededProof: z.string().trim().min(3).max(480),
  }).strict()).min(1).max(8),
  attackQuestions: z.array(z.string().trim().min(4).max(400)).min(1).max(8),
  nextGate: z.enum(["collect-evidence", "independent-verification", "human-review"]),
  gateReason: z.string().trim().min(8).max(650),
}).strict();
export type ClaimReview = z.infer<typeof reviewSchema>;

export function parseClaimReview(text: string): ClaimReview {
  if (text.length > 16000) throw new Error("AI output exceeded the review limit.");
  let json: unknown;
  try { json = JSON.parse(text); }
  catch { throw new Error("AI output was not valid JSON."); }
  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success) throw new Error("AI output was not a valid advisory review.");
  return parsed.data;
}

/** Server-owned UUID allowlist, not an email, browser setting or user_metadata flag. */
export function isAllowedOwner(userId: string, allowlist: string): boolean {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid.test(userId) && allowlist.split(",")
    .map(v => v.trim().toLowerCase()).filter(v => uuid.test(v))
    .includes(userId.toLowerCase());
}

export type SearchPage = {
  url: string;
  state: "indexed" | "not_indexed" | "unknown";
  coverage: string | null;
  lastCrawl: string | null;
  googleCanonical: string | null;
  robotsState: string | null;
  error: string | null;
};
export type SearchConsoleSnapshot = {
  property: string;
  checkedAt: string;
  dataScope: "canonical_url_inspections";
  sitewideIndexedCount: null;
  sitemap: {
    processing: "pending" | "processed" | "not_submitted" | "unknown";
    submittedAt: string | null;
    downloadedAt: string | null;
    submittedUrls: number | null;
    errors: number | null;
    warnings: number | null;
  };
  pages: SearchPage[];
};

type UnknownRecord = Record<string, unknown>;
function record(v: unknown): UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? v as UnknownRecord : {};
}
function smallString(v: unknown): string | null {
  return typeof v === "string" && v.length <= 500 ? v : null;
}
function count(v: unknown): number | null {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}
function submittedFromContents(input: unknown): number | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  let total = 0;
  for (const item of input) {
    const value = count(record(item)["submitted"]);
    if (value === null || !Number.isSafeInteger(total + value)) return null;
    total += value;
  }
  return total;
}

export function normalizeSearchConsole(input: {
  checkedAt: string;
  sitemapResponse: unknown;
  inspections: Array<{url: string; response?: unknown; error?: string}>;
}): SearchConsoleSnapshot {
  const s = record(input.sitemapResponse);
  const entries = Array.isArray(s["sitemap"]) ? s["sitemap"] : [];
  const matching = entries.map(record).find(v => v["path"] === SEARCH_SITEMAP);
  const sitemap = matching ? {
    processing: matching["isPending"] === true ? "pending" as const :
      matching["isPending"] === false ? "processed" as const : "unknown" as const,
    submittedAt: smallString(matching["lastSubmitted"]),
    downloadedAt: smallString(matching["lastDownloaded"]),
    submittedUrls: submittedFromContents(matching["contents"]),
    errors: count(matching["errors"]),
    warnings: count(matching["warnings"]),
  } : {
    processing: "not_submitted" as const,
    submittedAt: null,
    downloadedAt: null,
    submittedUrls: null,
    errors: null,
    warnings: null,
  };
  const pages = input.inspections
    .filter(p => MONITORED_PAGES.includes(p.url))
    .map(p => {
      const data = record(record(p.response)["inspectionResult"]);
      const status = record(data["indexStatusResult"]);
      const verdict = smallString(status["verdict"]);
      const state: SearchPage["state"] = p.error || !verdict ? "unknown" :
        verdict === "PASS" ? "indexed" : verdict === "FAIL" ? "not_indexed" : "unknown";
      return {
        url: p.url,
        state,
        coverage: smallString(status["coverageState"]),
        lastCrawl: smallString(status["lastCrawlTime"]),
        googleCanonical: smallString(status["googleCanonical"]),
        robotsState: smallString(status["robotsTxtState"]),
        error: p.error ?? null,
      };
    });
  return { property: SEARCH_PROPERTY, checkedAt: input.checkedAt,
    dataScope: "canonical_url_inspections", sitewideIndexedCount: null, sitemap, pages };
}
