import { describe, expect, it, vi } from "vitest";
import { linkAuthenticatedShopifyCustomer, trustedShopifyEndpoint } from "./shopify-customer-link";

const uid = "123e4567-e89b-42d3-a456-426614174000";
const input = {
  supabaseAccessToken: "valid-session",
  authorizationCode: "shopify-code",
  codeVerifier: "x".repeat(64),
  redirectUri: "https://www.truthweaver.jussco.company/account",
};
function deps() {
  return {
    verifyUser: vi.fn(async () => uid),
    exchangeCode: vi.fn(async () => "ShopifyOpaqueOAuthAccessToken0123456789"),
    readShopifyCustomerId: vi.fn(async () => "gid://shopify/Customer/12345"),
    persistBinding: vi.fn(async () => "linked" as const),
  };
}
describe("Shopify buyer identity link", () => {
  it("links only after both provider identities are verified, with no client-chosen buyer ID", async () => {
    const d = deps();
    expect(await linkAuthenticatedShopifyCustomer(input, d)).toEqual({ linked: true });
    expect(d.persistBinding).toHaveBeenCalledWith(uid, "gid://shopify/Customer/12345");
    expect(d.exchangeCode).toHaveBeenCalledWith(input.authorizationCode, input.codeVerifier, input.redirectUri);
  });
  it("denies an invalid Supabase session without calling Shopify", async () => {
    const d = deps(); d.verifyUser.mockResolvedValueOnce(null as never);
    expect(await linkAuthenticatedShopifyCustomer(input, d)).toEqual({ linked: false, reason: "invalid_session" });
    expect(d.exchangeCode).not.toHaveBeenCalled();
    expect(d.persistBinding).not.toHaveBeenCalled();
  });
  it("rejects missing verification or invalid customer IDs and never stores those", async () => {
    const d = deps(); d.readShopifyCustomerId.mockResolvedValueOnce("gid://shopify/Order/111" as never);
    expect(await linkAuthenticatedShopifyCustomer(input, d)).toEqual({ linked: false, reason: "shopify_unverified" });
    expect(d.persistBinding).not.toHaveBeenCalled();
    const d2 = deps(); d2.exchangeCode.mockResolvedValueOnce(null as never);
    expect(await linkAuthenticatedShopifyCustomer(input, d2)).toEqual({ linked: false, reason: "shopify_unverified" });
    expect(d2.persistBinding).not.toHaveBeenCalled();
  });
  it("does not overwrite an existing binding to a different buyer", async () => {
    const d = deps(); d.persistBinding.mockResolvedValueOnce("conflict" as never);
    expect(await linkAuthenticatedShopifyCustomer(input, d)).toEqual({ linked: false, reason: "conflict" });
  });
  it("rejects unsafe discovered OAuth and GraphQL endpoints", () => {
    const host = "fcr-truth-weaver-esimv-203acj81.myshopify.com";
    expect(trustedShopifyEndpoint(`https://${host}/authentication/oauth/token`, "token", host)).toBe(true);
    expect(trustedShopifyEndpoint(`https://${host}/customer/api/2026-10/graphql`, "graphql", host)).toBe(true);
    expect(trustedShopifyEndpoint("http://evil.com/oauth/token", "token", host)).toBe(false);
    expect(trustedShopifyEndpoint("https://evil.com/authentication/oauth/token", "token", host)).toBe(false);
    expect(trustedShopifyEndpoint("https://shopify.com.attacker.com/customer/api/2026-10/graphql", "graphql", host)).toBe(false);
    expect(trustedShopifyEndpoint("https://another-shop.myshopify.com/customer/api/2026-10/graphql", "graphql", host)).toBe(false);
    expect(trustedShopifyEndpoint("https://evil.shopify.com/authentication/oauth/token", "token", host)).toBe(false);
    // Exact endpoint paths returned by this shop's live OpenID + Customer API discovery.
    expect(trustedShopifyEndpoint("https://shopify.com/authentication/85973860573/oauth/authorize", "authorization", host)).toBe(true);
    expect(trustedShopifyEndpoint("https://shopify.com/authentication/85973860573/oauth/token", "token", host)).toBe(true);
    expect(trustedShopifyEndpoint("https://shopify.com/85973860573/account/customer/api/2026-10/graphql", "graphql", host)).toBe(true);
    expect(trustedShopifyEndpoint("https://shopify.com/authentication/12345/oauth/token", "token", host)).toBe(false);
    expect(trustedShopifyEndpoint("https://shopify.com/12345/account/customer/api/2026-10/graphql", "graphql", host)).toBe(false);
    expect(trustedShopifyEndpoint("https://shopify.com/authentication/oauth/authorize", "authorization", host)).toBe(false);
    expect(trustedShopifyEndpoint("https://accounts.shopify.com/authentication/oauth/token", "token", host)).toBe(false);
    expect(trustedShopifyEndpoint("https://shopify.com/authentication/85973860573/oauth/token/other", "token", host)).toBe(false);
  });
});
