/** Server-only, per-instance token cache. Never log credentials or token responses.
 * Shopify decides installation/organization eligibility; any failure denies access.
 * The legacy connector token is available only to the existing merchant caller.
 */
const TOKEN_URL = "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/admin/oauth/access_token";
const SKEW_SECONDS = 300;
const MAX_LIFETIME_SECONDS = 86_400;
type Credentials = { clientId: string; clientSecret: string };
type CachedToken = Credentials & { token: string; usableUntil: number };
let cached: CachedToken | null = null;
let pending: (Credentials & { promise: Promise<string | null> }) | null = null;

function validToken(value: unknown): value is string {
  return typeof value === "string" && /^[\x21-\x7e]{1,4096}$/.test(value);
}

function matches(left: Credentials, right: Credentials) {
  return left.clientId === right.clientId && left.clientSecret === right.clientSecret;
}

export async function getTruthWeaverShopifyAdminToken(
  options: { allowMerchantLegacy?: boolean } = {},
): Promise<string | null> {
  const legacy = process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"] ||
    (options.allowMerchantLegacy ? process.env["SHOPIFY_ACCESS_TOKEN"] : undefined);
  if (legacy) return validToken(legacy) ? legacy : null;

  const clientId = process.env["SHOPIFY_CLIENT_ID"];
  const clientSecret = process.env["SHOPIFY_CLIENT_SECRET"];
  if (!clientId || !clientSecret || clientId.length > 4096 || clientSecret.length > 4096 ||
      clientId.trim() !== clientId || clientSecret.trim() !== clientSecret) {
    cached = null;
    pending = null;
    return null;
  }
  const credentials = { clientId, clientSecret };
  if (cached && matches(cached, credentials) && Date.now() < cached.usableUntil) return cached.token;
  cached = null;
  if (pending && matches(pending, credentials)) return pending.promise;

  const startedAt = Date.now();
  const promise = (async (): Promise<string | null> => {
    try {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
      });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("access_token" in body) || !("expires_in" in body) ||
          "error" in body || "errors" in body || !validToken(body.access_token) ||
          typeof body.expires_in !== "number" || !Number.isInteger(body.expires_in) ||
          body.expires_in <= SKEW_SECONDS || body.expires_in > MAX_LIFETIME_SECONDS) return null;
      const usableUntil = startedAt + (body.expires_in - SKEW_SECONDS) * 1000;
      if (Date.now() >= usableUntil || process.env["SHOPIFY_CLIENT_ID"] !== clientId ||
          process.env["SHOPIFY_CLIENT_SECRET"] !== clientSecret) return null;
      cached = { ...credentials, token: body.access_token, usableUntil };
      return body.access_token;
    } catch {
      return null;
    }
  })();
  const flight = { ...credentials, promise };
  pending = flight;
  try {
    return await promise;
  } finally {
    if (pending === flight) pending = null;
  }
}