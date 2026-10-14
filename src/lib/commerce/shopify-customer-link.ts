/** Browser credentials never establish a paid order or grant an entitlement.
 * This exchange links TWO provider-authenticated identities, nothing else.
 */
export type CustomerLinkInput = {
  supabaseAccessToken: string;
  authorizationCode: string;
  codeVerifier: string;
  redirectUri: string;
};
export type CustomerLinkDeps = {
  verifyUser(token: string): Promise<string | null>;
  exchangeCode(code: string, verifier: string, redirectUri: string): Promise<string | null>;
  readShopifyCustomerId(customerToken: string): Promise<string | null>;
  persistBinding(userId: string, shopifyId: string): Promise<"linked" | "already_linked" | "conflict">;
};
export type CustomerLinkResult =
  | { linked: true }
  | { linked: false; reason: "invalid_session" | "invalid_request" | "shopify_unverified" | "conflict" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOMER_GID = /^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;

/** Require server-owned Supabase identity and Shopify customer(id) obtained from Shopify's authenticated API. */
export async function linkAuthenticatedShopifyCustomer(
  input: CustomerLinkInput,
  deps: CustomerLinkDeps,
): Promise<CustomerLinkResult> {
  if (!input.supabaseAccessToken || input.supabaseAccessToken.length > 8192 ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(input.codeVerifier) ||
    !input.authorizationCode || input.authorizationCode.length > 2048) {
    return { linked: false, reason: "invalid_request" };
  }
  const userId = await deps.verifyUser(input.supabaseAccessToken);
  if (!userId || !UUID.test(userId)) return { linked: false, reason: "invalid_session" };
  const shopifyToken = await deps.exchangeCode(input.authorizationCode, input.codeVerifier, input.redirectUri);
  if (!shopifyToken) return { linked: false, reason: "shopify_unverified" };
  const customerId = await deps.readShopifyCustomerId(shopifyToken);
  if (!customerId || !CUSTOMER_GID.test(customerId)) return { linked: false, reason: "shopify_unverified" };
  const saved = await deps.persistBinding(userId, customerId);
  return saved === "conflict" ? { linked: false, reason: "conflict" } : { linked: true };
}

/** Restrict Shopify discovery URLs to this specific merchant and API version. */
export function trustedShopifyEndpoint(
  value: string,
  kind: "authorization" | "token" | "graphql",
  trustedHost: string,
): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash || u.search) return false;
    if (u.hostname !== trustedHost && u.hostname !== "shopify.com") return false;
    const inShopifyAccounts = u.hostname === "shopify.com";
    const shopPrefix = "/authentication/85973860573/oauth/";
    const merchantPrefix = "/authentication/oauth/";
    const authPrefix = inShopifyAccounts ? shopPrefix : merchantPrefix;
    if (kind === "authorization") return u.pathname === authPrefix + "authorize";
    if (kind === "token") return u.pathname === authPrefix + "token";
    const apiPath = inShopifyAccounts
      ? "/85973860573/account/customer/api/2026-10/graphql"
      : "/customer/api/2026-10/graphql";
    return u.pathname === apiPath;
  } catch {
    return false;
  }
}
