import { describe, expect, it } from "vitest";

import { candidatesFor, categoryFallback, handleSchema, parseRecommendationOutput } from "./recommendations";
import type { ShopifyProduct } from "./shopify";

function product(handle: string, opts: { tags?: string[]; type?: string; available?: boolean } = {}): ShopifyProduct {
  return {
    node: {
      id: `gid://shopify/Product/${handle}`,
      title: handle,
      description: `${handle} description`,
      handle,
      productType: opts.type ?? "",
      tags: opts.tags ?? [],
      priceRange: { minVariantPrice: { amount: "10.0", currencyCode: "USD" } },
      images: { edges: [] },
      variants: { edges: [{ node: { id: `v-${handle}`, title: "Default", price: { amount: "10.0", currencyCode: "USD" }, availableForSale: opts.available ?? true, selectedOptions: [] } }] },
      options: [],
    },
  };
}

const current = product("snapshot", { tags: ["notice-analysis"], type: "Legal-navigation tool" });
const catalog = [current, product("deep-dive", { tags: ["notice-analysis"] }), product("premium", { type: "Legal-navigation tool" }), product("sold-out", { available: false }), product("unrelated")];

describe("recommendations", () => {
  it("never recommends the current product or a sold-out one", () => {
    const handles = candidatesFor(current, catalog).map((p) => p.node.handle);
    expect(handles).not.toContain("snapshot");
    expect(handles).not.toContain("sold-out");
  });

  it("drops any product the AI invents and keeps only catalog items", () => {
    const out = parseRecommendationOutput(
      JSON.stringify({ recommendations: [{ handle: "made-up-product", reason: "x" }, { handle: "deep-dive", reason: "Same topic" }] }),
      candidatesFor(current, catalog),
    );
    expect(out.map((r) => r.product.node.handle)).toEqual(["deep-dive"]);
  });

  it("dedupes and caps at 3 picks", () => {
    const many = ["deep-dive", "deep-dive", "premium", "unrelated", "deep-dive"].map((handle) => ({ handle, reason: "r" }));
    const extra = [...catalog, product("fourth")];
    const out = parseRecommendationOutput(JSON.stringify({ recommendations: [...many, { handle: "fourth", reason: "r" }] }), candidatesFor(current, extra));
    expect(out.map((r) => r.product.node.handle)).toEqual(["deep-dive", "premium", "unrelated"]);
  });

  it("rejects output that is not JSON", () => {
    expect(() => parseRecommendationOutput("I think you should buy everything", candidatesFor(current, catalog))).toThrow();
  });

  it("category fallback only returns items sharing a tag or type", () => {
    const out = categoryFallback(current, candidatesFor(current, catalog));
    expect(out.map((r) => r.product.node.handle)).toEqual(["deep-dive", "premium"]);
  });

  it("only accepts safe product handles", () => {
    expect(handleSchema.safeParse("truth-weaver-notice-snapshot").success).toBe(true);
    expect(handleSchema.safeParse("../admin").success).toBe(false);
    expect(handleSchema.safeParse("A B").success).toBe(false);
  });
});
