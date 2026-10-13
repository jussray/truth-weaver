import { describe, expect, it } from "vitest";

import { formatCheckoutUrl } from "./shopify";

describe("Truth Weaver Shopify checkout URL", () => {
  it("preserves Shopify's checkout URL and its existing query string", () => {
    const url =
      "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/cn/example?key=checkout-key&locale=en-US";
    expect(formatCheckoutUrl(url)).toBe(url);
  });

  it("accepts the same-store Shopify cart checkout path", () => {
    const url = "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/cart/c/abc?key=shopify";
    expect(formatCheckoutUrl(url)).toBe(url);
  });

  it.each([
    "http://fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/example",
    "javascript:alert(1)",
    "https://shopify.com.attacker.example/checkouts/example",
    "https://another-merchant.myshopify.com/checkouts/cn/attacker",
    "https://checkout.shopify.com/checkouts/cn/different-merchant",
    "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/products/unrelated",
    "https://buyer:secret@fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/cn/example",
    "https://fcr-truth-weaver-esimv-203acj81.myshopify.com:8443/checkouts/cn/example",
    "https://example.org/checkout",
    "not a url",
  ])("rejects an invalid or untrusted checkout destination: %s", (url) => {
    expect(formatCheckoutUrl(url)).toBeNull();
  });
});
