import { describe, expect, it } from "vitest";

import { SHOP_CATEGORIES, buildShopQuery, findCategory, plannedShopOffers } from "./shop-categories";

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
  it("lists only the four prepared, non-Snapshot report offers on the unfiltered shop", () => {
    const offers = plannedShopOffers();
    expect(offers.map((offer) => offer.key)).toEqual(["guide", "templates", "course", "bundle"]);
    expect(offers.every((offer) => offer.variantGid === null)).toBe(true);
  });

  it("limits previews to the selected category", () => {
    expect(plannedShopOffers("guides").map((offer) => offer.label)).toEqual(["Notice Response Guide"]);
    expect(plannedShopOffers("courses").map((offer) => offer.label)).toEqual(["Notice Basics Course"]);
    expect(plannedShopOffers("bundles").map((offer) => offer.label)).toEqual(["Notice Complete Bundle"]);
  });

  it("does not misrepresent an offer as available for an unverified legal area", () => {
    expect(plannedShopOffers("guides", "Housing")).toEqual([]);
    expect(plannedShopOffers(undefined, "Family")).toEqual([]);
    expect(plannedShopOffers("unknown")).toEqual([]);
  });
});
