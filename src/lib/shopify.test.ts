import { describe, expect, it, vi } from "vitest";

import { addLineToShopifyCart, createShopifyCart, fetchLiveCart, formatCheckoutUrl } from "./shopify";
import { NOTICE_VARIANTS } from "./commerce/shopify-order-proof";
import { isStorefrontVariantSellable } from "./commerce/storefront-launch-guard";

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

describe("Truth Weaver launch-hold purchase boundary", () => {
  it("denies each known Notice variant regardless of public Shopify availability", () => {
    expect(isStorefrontVariantSellable(NOTICE_VARIANTS.snapshot)).toBe(false);
    expect(isStorefrontVariantSellable(NOTICE_VARIANTS.deepDive)).toBe(false);
    expect(isStorefrontVariantSellable(NOTICE_VARIANTS.premium)).toBe(false);
  });

  it("denies products tagged launch-hold and permits an unrelated unheld variant", () => {
    expect(isStorefrontVariantSellable("gid://shopify/ProductVariant/999", ["launch-hold"])).toBe(false);
    expect(isStorefrontVariantSellable("gid://shopify/ProductVariant/999", ["LAUNCH-HOLD"])).toBe(false);
    expect(isStorefrontVariantSellable("gid://shopify/ProductVariant/999", [])).toBe(true);
  });

  it("blocks held cart creation and line additions before calling Shopify", async () => {
    const originalFetch = globalThis.fetch;
    const request = vi.fn();
    globalThis.fetch = request as typeof fetch;
    try {
      expect(await createShopifyCart(NOTICE_VARIANTS.snapshot, 1)).toBeNull();
      expect(await addLineToShopifyCart("cart-1", NOTICE_VARIANTS.premium, 1))
        .toEqual({ success: false });
      expect(request).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects restored Shopify carts containing a launch-held variant", async () => {
    const originalFetch = globalThis.fetch;
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { cart: {
        id: "cart-1", totalQuantity: 1,
        checkoutUrl: "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/cn/test",
        lines: { edges: [{ node: {
          id: "line-1", quantity: 1,
          merchandise: { id: NOTICE_VARIANTS.deepDive, price: { amount: "29.00", currencyCode: "USD" } },
        } }] },
      } },
    }), { status: 200 }));
    globalThis.fetch = request as typeof fetch;
    try {
      await expect(fetchLiveCart("cart-1")).rejects.toThrow("launch-held");
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
