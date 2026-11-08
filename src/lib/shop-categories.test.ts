import { describe, expect, it } from "vitest";

import { SHOP_CATEGORIES, buildShopQuery, findCategory } from "./shop-categories";

describe("shop categories", () => {
  it("has exactly guides, templates, courses and bundles", () => {
    expect(SHOP_CATEGORIES.map((c) => c.slug)).toEqual(["guides", "templates", "courses", "bundles"]);
  });

  it("queries the canonical and legacy product type for a category", () => {
    expect(buildShopQuery("guides")).toBe('(product_type:"Guide" OR product_type:"guides")');
  });

  it("combines category and legal-area tag", () => {
    expect(buildShopQuery("templates", "Housing")).toBe('(product_type:"Template" OR product_type:"templates") AND tag:"Housing"');
  });

  it("ignores unknown categories and strips quote injection from areas", () => {
    expect(findCategory("weapons")).toBeUndefined();
    expect(buildShopQuery("weapons")).toBeUndefined();
    expect(buildShopQuery(undefined, 'Housing" OR tag:"x')).toBe('tag:"Housing OR tag:x"');
  });
});
