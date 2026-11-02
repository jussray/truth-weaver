import { searchablePages, summarizeIndexStatus, type IndexInspection } from "./owner-intelligence";

const CANONICAL_PROPERTY = "https://truthweaver.jussco.company/";
const SITEMAP = "https://truthweaver.jussco.company/sitemap.xml";
const ALLOWED_PROPERTIES = new Set([
  CANONICAL_PROPERTY,
  "sc-domain:truthweaver.jussco.company",
  "sc-domain:jussco.company",
]);

type SitemapRecord = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  errors?: string | number;
  warnings?: string | number;
  contents?: Array<{ type?: string; submitted?: string | number; indexed?: string | number }>;
};

export type SearchConsoleSnapshot = {
  connected: boolean;
  checkedAt: string;
  property: string;
  sitemap: string;
  sitemaps: SitemapRecord[];
  pages: Array<ReturnType<typeof summarizeIndexStatus> & { error?: string }>;
  error: string | null;
  note: string;
};

async function googleToken(): Promise<string> {
  const clientId = process.env["GSC_CLIENT_ID"];
  const clientSecret = process.env["GSC_CLIENT_SECRET"];
  const refreshToken = process.env["GSC_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Search Console credentials are not configured.");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Search Console authorization is unavailable.");
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("Search Console did not grant read access.");
  return body.access_token;
}

async function googleJson<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google Search Console API responded ${response.status}.`);
  return (await response.json()) as T;
}

export async function loadSearchConsoleSnapshot(): Promise<SearchConsoleSnapshot> {
  const property = process.env["GSC_SITE_URL"] || CANONICAL_PROPERTY;
  const base: SearchConsoleSnapshot = {
    connected: false,
    checkedAt: new Date().toISOString(),
    property,
    sitemap: SITEMAP,
    sitemaps: [],
    pages: searchablePages().map((url) => summarizeIndexStatus(url, undefined)),
    error: null,
    note: "URL Inspection reports Google's indexed version, not a live crawl test. Results are not guaranteed to be current.",
  };
  if (!ALLOWED_PROPERTIES.has(property)) {
    return { ...base, error: "The configured Search Console property is not approved for this site." };
  }
  try {
    const token = await googleToken();
    const sites = await googleJson<{ siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }>(
      token,
      "https://www.googleapis.com/webmasters/v3/sites",
    );
    if (!sites.siteEntry?.some((site) => site.siteUrl === property && site.permissionLevel !== "siteUnverifiedUser")) {
      return { ...base, error: "The connected Google account does not have verified Search Console access to this property." };
    }
    const sitemaps = await googleJson<{ sitemap?: SitemapRecord[] }>(
      token,
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps`,
    );
    const urls = searchablePages();
    const pages = await Promise.all(urls.map(async (url) => {
      try {
        const record = await googleJson<{ inspectionResult?: IndexInspection }>(
          token,
          "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: "en-US" }),
          },
        );
        return summarizeIndexStatus(url, record.inspectionResult);
      } catch {
        return { ...summarizeIndexStatus(url, undefined), error: "URL inspection unavailable or quota exceeded." };
      }
    }));
    return { ...base, connected: true, checkedAt: new Date().toISOString(), sitemaps: sitemaps.sitemap ?? [], pages };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : "Search Console is currently unavailable.",
    };
  }
}
