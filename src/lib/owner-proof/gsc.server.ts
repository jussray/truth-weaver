import {
  MONITORED_PAGES, SEARCH_PROPERTY, normalizeSearchConsole,
  type SearchConsoleSnapshot,
} from "./contract";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SITEMAPS_URL = "https://www.googleapis.com/webmasters/v3/sites/";
const GOOGLE_INSPECTION_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const TTL = 15 * 60_000;
type Credentials = { client_email: string; private_key: string };
let cached: { until: number; value: SearchConsoleSnapshot } | null = null;

function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function credentials(): Credentials | null {
  const raw = process.env["GSC_SERVICE_ACCOUNT_JSON"];
  if (!raw) return null;
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw new Error("Search Console credentials are invalid."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Search Console credentials are invalid.");
  const record = data as Record<string, unknown>;
  const email = record["client_email"];
  const key = record["private_key"];
  if (typeof email !== "string" || !email.endsWith(".gserviceaccount.com") ||
      typeof key !== "string" || !key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("Search Console credentials are invalid.");
  }
  return {client_email: email,private_key: key};
}
async function googleToken(account: Credentials): Promise<string> {
  const now = Math.floor(Date.now()/1000);
  const header = base64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const payload = base64url(JSON.stringify({
    iss:account.client_email,scope:GOOGLE_SCOPE,aud:GOOGLE_TOKEN_URL,iat:now,exp:now+900,
  }));
  const unsigned = header+"."+payload;
  const bin = atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  const key = await crypto.subtle.importKey("pkcs8",Uint8Array.from(bin,c=>c.charCodeAt(0)),
    {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signed = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned)));
  const response = await fetch(GOOGLE_TOKEN_URL,{
    method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(9000),
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+base64url(signed)}),
  });
  if (!response.ok) throw new Error("Search Console authentication failed.");
  const json: unknown = await response.json();
  const token = json && typeof json === "object" ? (json as Record<string,unknown>)["access_token"] : null;
  if (typeof token !== "string" || !token || token.length > 8192)
    throw new Error("Search Console authentication failed.");
  return token;
}
async function googleRead(url: string, token: string, body?: Record<string,string>): Promise<unknown> {
  const response = await fetch(url,{
    method:body?"POST":"GET",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10_000),
    headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  if (!response.ok) {
    if (response.status===403) throw new Error("Search Console access denied; verify property permissions.");
    if (response.status===429) throw new Error("Google Search Console inspection quota exceeded.");
    throw new Error("Google Search Console request unavailable.");
  }
  return response.json();
}

export type GscRead =
 | { state:"not_configured"; property:string }
 | { state:"connected"; report:SearchConsoleSnapshot };

export async function readOwnerSearchConsole(): Promise<GscRead> {
  // Always call from owner-authorized server function. This module never ships client-side.
  const c = credentials();
  if (!c) return {state:"not_configured",property:SEARCH_PROPERTY};
  if (cached && Date.now()<cached.until) return {state:"connected",report:cached.value};
  const token = await googleToken(c);
  const sitemapResponse = await googleRead(GOOGLE_SITEMAPS_URL+encodeURIComponent(SEARCH_PROPERTY)+"/sitemaps",token);
  const inspections: Array<{url:string;response?:unknown;error?:string}> = [];
  // Bounded exact canonical URLs. Do not inspect arbitrary supplied domains or private routes.
  for (const url of MONITORED_PAGES) {
    try {
      const response = await googleRead(GOOGLE_INSPECTION_URL,token,{
        inspectionUrl:url,siteUrl:SEARCH_PROPERTY,languageCode:"en-US",
      });
      inspections.push({url,response});
    } catch {
      inspections.push({url,error:"inspection_unavailable"});
    }
  }
  const report=normalizeSearchConsole({checkedAt:new Date().toISOString(),sitemapResponse,inspections});
  cached={until:Date.now()+TTL,value:report};
  return {state:"connected",report};
}
