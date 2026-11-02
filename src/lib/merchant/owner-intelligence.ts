import { z } from "zod";

import { canonicalUrl, INDEXABLE_PATHS } from "@/lib/seo";

const evidenceEntry = z.object({
  label: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(5).max(1600),
  sourceUrl: z.string().trim().url().max(1200)
    .refine((value) => new URL(value).protocol === "https:", "Evidence links must use HTTPS.")
    .optional(),
}).strict();

export const evidenceReviewInputSchema = z.object({
  claim: z.string().trim().min(15).max(3000),
  evidence: z.array(evidenceEntry).min(1).max(8),
}).strict();

const nextGate = z.object({
  action: z.string().trim().min(8).max(400),
  requiredProof: z.string().trim().min(5).max(400),
  passCriterion: z.string().trim().min(5).max(400),
}).strict();

export const evidenceReviewResultSchema = z.object({
  evidenceGaps: z.array(z.string().trim().min(5).max(400)).max(8),
  attackQuestions: z.array(z.string().trim().min(5).max(400)).max(8),
  nextGate,
}).strict();

/** Model output is advisory and can never report a verified fact or authorize an action. */
export function parseEvidenceReview(text: string) {
  const trimmed = text.trim().replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/g, "");
  return evidenceReviewResultSchema.parse(JSON.parse(trimmed));
}

export function searchablePages() {
  return INDEXABLE_PATHS.map(canonicalUrl);
}

export type IndexInspection = {
  indexStatusResult?: {
    verdict?: string;
    coverageState?: string;
    indexingState?: string;
    robotsTxtState?: string;
    pageFetchState?: string;
    lastCrawlTime?: string;
    googleCanonical?: string;
    userCanonical?: string;
  };
};

export function summarizeIndexStatus(url: string, result: IndexInspection | undefined) {
  const i = result?.indexStatusResult;
  const verdict = i?.verdict ?? "UNKNOWN";
  const coverage = i?.coverageState ?? "Not reported";
  const status = verdict === "PASS"
    ? "INDEXED" as const
    : verdict === "FAIL" || /not indexed|excluded|discovered - currently|crawled - currently/i.test(coverage)
      ? "NOT_INDEXED" as const
      : "UNKNOWN" as const;
  return {
    url,
    status,
    verdict,
    coverage,
    lastCrawl: i?.lastCrawlTime ?? null,
    robotsState: i?.robotsTxtState ?? null,
    indexingState: i?.indexingState ?? null,
    pageFetchState: i?.pageFetchState ?? null,
    googleCanonical: i?.googleCanonical ?? null,
    userCanonical: i?.userCanonical ?? null,
  };
}
