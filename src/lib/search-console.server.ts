import { MONITORED_URLS, SEARCH_CONSOLE_PROPERTY, mapInspection, mapSitemap, type SearchConsoleSnapshot } from "./search-console";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TTL = 15 * 60 * 1000;
let last: { at: number; snapshot: SearchConsoleSnapshot } | null = null;

type ServiceAccount = { client_email: string; private_key: string };
function base64url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function credentials(): ServiceAccount | null {
  const raw = process.env["GSC_SERVICE_ACCOUNT_JSON"];
  if (!raw) return null;
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(raw) as Record<string, unknown>; }
  catch { throw new Error("Search Console service account is not configured correctly."); }
  if (typeof obj["client_email"] !== "string" || typeof obj["private_key"] !== "string"
    || !obj["client_email"].endsWith(".gserviceaccount.com") || !obj["private_key"].includes("BEGIN PRIVATE KEY")) {
    throw new Error("Search Console service account is not configured correctly.");
  }
  return { client_email: obj["client_email"], private_key: obj["private_key"] };
}
async function googleToken(c: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: c.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 1200 }));
  const signed = header + "." + claims;
  const binary = atob(c.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  const bytes = Uint8Array.from(binary, x => x.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signed)));
  const assertion = signed + "." + base64url(signature);
  const form = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("Search Console service account authentication failed.");
  const data: unknown = await response.json();
  const token = data && typeof data === "object" ? (data as Record<string, unknown>)["access_token"] : null;
  if (typeof token !== "string" || !token) throw new Error("Search Console service account authentication failed.");
  return token;
}
async function readGoogle(url: string, token: string, body?: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error("Search Console permission denied; grant the service account read access to this property.");
    if (response.status === 429) throw new Error("Search Console quota reached; retry after the quota window.");
    throw new Error("Search Console API unavailable (HTTP " + response.status + ").");
  }
  return response.json();
}
export async function readSearchConsoleSnapshot(): Promise<SearchConsoleSnapshot> {
  const c = credentials();
  if (!c) return { state: "not-configured", property: SEARCH_CONSOLE_PROPERTY, checkedAt: null, sitemap: null, pages: [], indexedCount: null, inspectedCount: 0 };
  if (last && Date.now() - last.at < TTL && last.snapshot.state === "connected") return last.snapshot;
  const token = await googleToken(c);
  const property = encodeURIComponent(SEARCH_CONSOLE_PROPERTY);
  const rawSitemaps = await readGoogle("https://www.googleapis.com/webmasters/v3/sites/" + property + "/sitemaps", token);
  const sitemap = mapSitemap(rawSitemaps);
  // Inspect the site's exact public canonical paths only, not arbitrary user input.
  // Deliberately bounded and sequential to limit provider quota consumption.
  const pages = [];
  for (const url of MONITORED_URLS) {
    const raw = await readGoogle("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", token, { inspectionUrl: url, siteUrl: SEARCH_CONSOLE_PROPERTY, languageCode: "en-US" });
    pages.push(mapInspection(url, raw));
  }
  const snapshot: SearchConsoleSnapshot = {
    state: "connected", property: SEARCH_CONSOLE_PROPERTY, checkedAt: new Date().toISOString(),
    sitemap, pages, indexedCount: pages.filter(x => x.state === "indexed").length,
    inspectedCount: pages.length,
  };
  last = { at: Date.now(), snapshot };
  return snapshot;
}