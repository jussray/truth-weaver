import { canonicalUrl, INDEXABLE_PATHS, SITE_URL } from "./seo";

export const SEARCH_CONSOLE_PROPERTY = SITE_URL + "/";
export const SEARCH_CONSOLE_SITEMAP = SITE_URL + "/sitemap.xml";
export const MONITORED_URLS: readonly string[] = INDEXABLE_PATHS.map(canonicalUrl);

export type IndexState = "indexed" | "not-indexed" | "unknown";
export type InspectedPage = {
  url: string;
  state: IndexState;
  coverage: string | null;
  lastCrawl: string | null;
  googleCanonical: string | null;
  robots: string | null;
};
export type SitemapSummary = {
  state: "processed" | "pending" | "not-submitted";
  submittedAt: string | null;
  downloadedAt: string | null;
  submittedUrls: number | null;
  errors: number;
  warnings: number;
};
export type SearchConsoleSnapshot =
  | { state: "not-configured"; property: string; checkedAt: null; sitemap: null; pages: []; indexedCount: null; inspectedCount: 0 }
  | { state: "connected"; property: string; checkedAt: string; sitemap: SitemapSummary; pages: InspectedPage[]; indexedCount: number; inspectedCount: number };

export function mapSitemap(response: unknown): SitemapSummary {
  const x = response && typeof response === "object" ? response as Record<string, unknown> : {};
  const rows = Array.isArray(x["sitemap"]) ? x["sitemap"] as Array<Record<string, unknown>> : [];
  const match = rows.find((row) => row["path"] === SEARCH_CONSOLE_SITEMAP);
  if (!match) return { state: "not-submitted", submittedAt: null, downloadedAt: null, submittedUrls: null, errors: 0, warnings: 0 };
  const n = (v: unknown) => typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v)) ? Math.max(0, Number(v)) : 0;
  const items = Array.isArray(match["contents"]) ? match["contents"] as Array<Record<string, unknown>> : [];
  return {
    state: match["isPending"] === true ? "pending" : "processed",
    submittedAt: typeof match["lastSubmitted"] === "string" ? match["lastSubmitted"] : null,
    downloadedAt: typeof match["lastDownloaded"] === "string" ? match["lastDownloaded"] : null,
    submittedUrls: items.length ? items.reduce((sum, item) => sum + n(item["submitted"]), 0) : null,
    errors: n(match["errors"]),
    warnings: n(match["warnings"]),
  };
}

export function mapInspection(url: string, response: unknown): InspectedPage {
  if (!MONITORED_URLS.includes(url)) throw new Error("Only configured public URLs may be inspected.");
  const outer = response && typeof response === "object" ? response as Record<string, unknown> : {};
  const inspection = outer["inspectionResult"] && typeof outer["inspectionResult"] === "object" ? outer["inspectionResult"] as Record<string, unknown> : {};
  const raw = inspection["indexStatusResult"] && typeof inspection["indexStatusResult"] === "object" ? inspection["indexStatusResult"] as Record<string, unknown> : {};
  const v = raw["verdict"];
  const pick = (key: string) => typeof raw[key] === "string" ? raw[key] as string : null;
  return {
    url,
    state: v === "PASS" ? "indexed" : v === "NEUTRAL" || v === "FAIL" ? "not-indexed" : "unknown",
    coverage: pick("coverageState"),
    lastCrawl: pick("lastCrawlTime"),
    googleCanonical: pick("googleCanonical"),
    robots: pick("robotsTxtState"),
  };
}