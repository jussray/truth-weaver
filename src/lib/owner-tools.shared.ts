import { z } from "zod";

/** Input is untrusted, potentially including malicious instructions in quoted evidence. */
export const claimInputSchema = z.object({
  claim: z.string().trim().min(12).max(2000),
  evidence: z.array(z.string().trim().min(10).max(1200)).min(1).max(8),
  consent: z.literal(true),
}).strict();

const short = z.string().trim().min(3).max(350);
const assessmentSchema = z.object({
  gaps: z.array(short).min(1).max(8),
  attackQuestions: z.array(short).min(1).max(8),
  nextGate: z.object({
    name: short,
    passCriteria: short,
    requiredEvidence: z.array(short).min(1).max(6),
  }).strict(),
}).strict();

export type EvidenceAssessment = z.infer<typeof assessmentSchema>;
export type ClaimInput = z.infer<typeof claimInputSchema>;

export function parseEvidenceAssessment(raw: string): EvidenceAssessment {
  if (raw.length > 16000) throw new Error("AI review exceeded its output limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("AI review did not return valid JSON."); }
  const output = assessmentSchema.safeParse(parsed);
  if (!output.success) throw new Error("AI review returned invalid or incomplete findings.");
  return output.data;
}

/** A URL inspection is NOT an aggregate Page Indexing report. */
export type PageInspection = {
  url: string;
  coverageState: string;
  verdict: string;
  lastCrawlTime: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  error: string | null;
};
export type SitemapRecord = {
  path: string;
  lastSubmitted: string | null;
  isPending: boolean | null;
  errors: number | null;
  warnings: number | null;
  submitted: number | null;
  indexed: number | null;
};
export type SearchConsoleReport = {
  checkedAt: string;
  property: string;
  kind: "sampled_url_inspections";
  sitemaps: SitemapRecord[];
  pages: PageInspection[];
};

type ValueRecord = Record<string, unknown>;
const obj = (input: unknown): ValueRecord =>
  input !== null && typeof input === "object" && !Array.isArray(input) ? input as ValueRecord : {};
const str = (v: unknown): string | null => typeof v === "string" && v.length < 500 ? v : null;
const nonnegative = (v: unknown): number | null => {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
};
function sumCounts(entries: unknown, field: "submitted" | "indexed"): number | null {
  if (!Array.isArray(entries) || !entries.length) return null;
  const nums = entries.map(entry => nonnegative(obj(entry)[field]));
  if (nums.some(n => n === null)) return null;
  return nums.reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

export function normalizeSearchConsoleStatus(input: {
  checkedAt: string;
  property: string;
  sitemaps: unknown[];
  pages: Array<{url: string; result?: unknown; error?: string}>;
}): SearchConsoleReport {
  return {
    checkedAt: input.checkedAt,
    property: input.property,
    kind: "sampled_url_inspections",
    sitemaps: input.sitemaps.map(raw => {
      const v = obj(raw);
      return {
        path: str(v["path"]) ?? "",
        lastSubmitted: str(v["lastSubmitted"]),
        isPending: typeof v["isPending"] === "boolean" ? v["isPending"] : null,
        errors: nonnegative(v["errors"]),
        warnings: nonnegative(v["warnings"]),
        submitted: sumCounts(v["contents"], "submitted"),
        indexed: sumCounts(v["contents"], "indexed"),
      };
    }),
    pages: input.pages.map(({url, result, error}) => {
      const status = obj(obj(result)["indexStatusResult"]);
      return {
        url,
        coverageState: str(status["coverageState"]) ?? "Unknown",
        verdict: str(status["verdict"]) ?? "UNKNOWN",
        lastCrawlTime: str(status["lastCrawlTime"]),
        robotsTxtState: str(status["robotsTxtState"]),
        indexingState: str(status["indexingState"]),
        error: error ?? null,
      };
    }),
  };
}
