import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TRUTH_WEAVER_SHOPIFY_DOMAIN } from "./shopify-order-proof";
import {
  linkAuthenticatedShopifyCustomer,
  trustedShopifyEndpoint,
  type CustomerLinkInput,
} from "./shopify-customer-link";

const CANONICAL_REDIRECT = "https://truthweaver.jussco.company/account";
const CUSTOMER_API_ORIGIN = "https://truthweaver.jussco.company";
const DISCOVERY_HOST = TRUTH_WEAVER_SHOPIFY_DOMAIN;

async function discover<T extends Record<string, unknown>>(path: string): Promise<T> {
  const resp = await fetch(`https://${DISCOVERY_HOST}${path}`, {
    redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error("Shopify customer authentication discovery is unavailable.");
  return await resp.json() as T;
}

/**
 * Server-only, fail-closed OAuth/PKCE code exchange and identity binding.
 * The user ID is never accepted from input; Shopify ID comes only from a
 * fresh authenticated Shopify Customer Account API call. No tokens are stored.
 */
export async function linkShopifyCustomerAccount(input: CustomerLinkInput) {
  const clientId = process.env["SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID"] ??
    process.env["VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID"];
  if (!clientId || input.redirectUri !== CANONICAL_REDIRECT) {
    return { linked: false as const, reason: "not_configured" as const };
  }
  try {
    return await linkAuthenticatedShopifyCustomer(input, {
      verifyUser: async token => {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        return error || !data.user ? null : data.user.id;
      },
      exchangeCode: async (code, verifier, redirectUri) => {
        const oidc = await discover<{ token_endpoint: string }>("/.well-known/openid-configuration");
        if (!trustedShopifyEndpoint(oidc.token_endpoint, "token", DISCOVERY_HOST)) return null;
        const response = await fetch(oidc.token_endpoint, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code", client_id: clientId,
            redirect_uri: redirectUri, code, code_verifier: verifier,
          }),
        });
        if (!response.ok) return null;
        const body = await response.json() as { access_token?: string };
        return typeof body.access_token === "string" && body.access_token.length >= 32 ? body.access_token : null;
      },
      readShopifyCustomerId: async customerToken => {
        const api = await discover<{ graphql_api: string }>("/.well-known/customer-account-api");
        if (!trustedShopifyEndpoint(api.graphql_api, "graphql", DISCOVERY_HOST)) return null;
        const response = await fetch(api.graphql_api, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
          headers: {
            "Content-Type": "application/json",
            Authorization: customerToken,
            // Shopify's Customer Account API checks allowed JavaScript origins.
            Origin: CUSTOMER_API_ORIGIN,
            "User-Agent": "TruthWeaver/1.0 (https://truthweaver.jussco.company)",
          },
          body: JSON.stringify({ query: "query TruthWeaverBuyerIdentity { customer { id } }" }),
        });
        if (!response.ok) return null;
        const result = await response.json() as {
          data?: { customer?: { id?: string } }; errors?: unknown[];
        };
        if (result.errors?.length) return null;
        return result.data?.customer?.id ?? null;
      },
      persistBinding: async (userId, shopifyId) => {
        const { data: existing, error: readError } = await supabaseAdmin
          .from("tw_shopify_customer_bindings")
          .select("shopify_customer_gid")
          .eq("auth_user_id", userId)
          .maybeSingle();
        if (readError) throw readError;
        if (existing) return existing.shopify_customer_gid === shopifyId ? "already_linked" : "conflict";
        // Unique customer GID + owner primary key prevent reuse and concurrent cross-account linking.
        const { error } = await supabaseAdmin.from("tw_shopify_customer_bindings").insert({
          auth_user_id: userId, shopify_customer_gid: shopifyId,
          verification_method: "verified_customer_account", verified_at: new Date().toISOString(),
        });
        return error ? "conflict" : "linked";
      },
    });
  } catch {
    // Provider/API errors never manufacture buyer identity or payment state.
    return { linked: false as const, reason: "shopify_unverified" as const };
  }
}

export async function getShopifyLinkStatus(authAccessToken: string): Promise<boolean> {
  if (!authAccessToken || authAccessToken.length > 8192) return false;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(authAccessToken);
    if (error || !data.user) return false;
    const { data: row, error: lookupError } = await supabaseAdmin
      .from("tw_shopify_customer_bindings")
      .select("auth_user_id").eq("auth_user_id", data.user.id).maybeSingle();
    return !lookupError && !!row;
  } catch { return false; }
}
