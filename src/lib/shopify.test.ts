import { describe, expect, it, vi } from "vitest";

import { addLineToShopifyCart, attachReportClaimToCart, clearReportClaimFromCart, createShopifyCart, fetchLiveCart, formatCheckoutUrl } from "./shopify";
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

  it("rejects restored carts whose non-Notice product gained launch-hold after it was added", async () => {
    const originalFetch = globalThis.fetch;
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { cart: {
        id: "cart-2", totalQuantity: 1,
        checkoutUrl: "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/cn/test",
        lines: { edges: [{ node: {
          id: "line-1", quantity: 1,
          merchandise: {
            id: "gid://shopify/ProductVariant/999",
            price: { amount: "5.00", currencyCode: "USD" },
            product: { tags: ["Launch-Hold"] },
          },
        } }] },
      } },
    }), { status: 200 }));
    globalThis.fetch = request as typeof fetch;
    try {
      await expect(fetchLiveCart("cart-2")).rejects.toThrow("launch-held");
      expect(String(request.mock.calls[0]?.[1]?.body)).toContain("product { tags }");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Truth Weaver per-order Shopify claim attributes", () => {
  const nonce = "a".repeat(43);
  const cartId = "gid://shopify/Cart/test";

  it("preserves unrelated cart attributes and verifies the returned claim", async () => {
    const originalFetch = globalThis.fetch;
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { cartAttributesUpdate: {
        cart: { id: cartId, attributes: [
          { key: "gift_note", value: "keep" },
          { key: "_tw_claim", value: nonce },
        ] },
        userErrors: [],
      } },
    }), { status: 200 }));
    globalThis.fetch = request as typeof fetch;
    try {
      expect(await attachReportClaimToCart(cartId, nonce, [
        { key: "gift_note", value: "keep" },
        { key: "_tw_claim", value: "b".repeat(43) },
      ])).toBe(true);
      const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
      expect(body.variables.attributes).toEqual([
        { key: "gift_note", value: "keep" },
        { key: "_tw_claim", value: nonce },
      ]);
      expect(body.query).toContain("cartAttributesUpdate");
    } finally { globalThis.fetch = originalFetch; }
  });

  it("fails closed when Shopify omits claim confirmation", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { cartAttributesUpdate: { cart: { id: cartId, attributes: [] }, userErrors: [] } },
    }), { status: 200 })) as typeof fetch;
    try {
      expect(await attachReportClaimToCart(cartId, nonce, [])).toBe(false);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("removes stale report claims while retaining unrelated cart metadata", async () => {
    const originalFetch = globalThis.fetch;
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { cartAttributesUpdate: {
        cart: { id: cartId, attributes: [{ key: "gift_note", value: "keep" }] },
        userErrors: [],
      } },
    }), { status: 200 }));
    globalThis.fetch = request as typeof fetch;
    try {
      expect(await clearReportClaimFromCart(cartId, [
        { key: "_tw_claim", value: nonce },
        { key: "gift_note", value: "keep" },
      ])).toBe(true);
      const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
      expect(body.variables.attributes).toEqual([{ key: "gift_note", value: "keep" }]);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("fails closed if stale report claim remains after update", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { cartAttributesUpdate: { cart: { id: cartId, attributes: [{ key: "_tw_claim", value: nonce }] }, userErrors: [] } },
    }), { status: 200 })) as typeof fetch;
    try {
      expect(await clearReportClaimFromCart(cartId, [{ key: "_tw_claim", value: nonce }])).toBe(false);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("rejects an invalid claim without contacting Shopify", async () => {
    const originalFetch = globalThis.fetch;
    const request = vi.fn();
    globalThis.fetch = request as typeof fetch;
    try {
      expect(await attachReportClaimToCart(cartId, "browser-invented", [])).toBe(false);
      expect(request).not.toHaveBeenCalled();
    } finally { globalThis.fetch = originalFetch; }
  });
});
