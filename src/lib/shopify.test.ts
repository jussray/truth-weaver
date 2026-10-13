import { describe, expect, it } from "vitest";

import { formatCheckoutUrl } from "./shopify";

describe("Truth Weaver Shopify checkout URL", () => {
  it("preserves Shopify's checkout URL and its existing query string", () => {
    const url =
      "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/cn/example?key=checkout-key&locale=en-US";
    expect(formatCheckoutUrl(url)).toBe(url);
  });

  it.each([
    "http://fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/example",
    "javascript:alert(1)",
    "https://shopify.com.attacker.example/checkouts/example",
    "https://example.org/checkout",
    "not a url",
  ])("rejects an invalid or untrusted checkout destination: %s", (url) => {
    expect(formatCheckoutUrl(url)).toBeNull();
  });
});
