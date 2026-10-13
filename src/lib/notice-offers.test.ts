import { describe, expect, it } from "vitest";
import { NOTICE_OFFERS, canFulfillNoticeOffer, isNoticeOfferSellable } from "./notice-offers";

describe("Truth Weaver notice offer launch contract", () => {
  it("records founder-approved USD prices and unique SKUs", () => {
    expect([NOTICE_OFFERS.snapshot.priceUsd, NOTICE_OFFERS.deepDive.priceUsd, NOTICE_OFFERS.premium.priceUsd]).toEqual([10, 29, 49]);
    expect(new Set(Object.values(NOTICE_OFFERS).map((o) => o.sku)).size).toBe(3);
  });

  it("maps each planned SKU to its verified Shopify-hosted illustration without changing sellability", () => {
    for (const offer of Object.values(NOTICE_OFFERS)) {
      expect(offer.imageUrl).toMatch(/^https:\/\/cdn\.shopify\.com\/s\/files\//);
      expect(new URL(offer.imageUrl).protocol).toBe("https:");
      expect(offer.imageAlt).toContain(offer.label);
      expect(offer.readyForSale).toBe(false);
    }
    expect(new Set(Object.values(NOTICE_OFFERS).map((o) => o.imageUrl)).size).toBe(3);
  });

  it.each(["snapshot", "deepDive", "premium"] as const)(
    "%s is never silently available for purchase before a separate launch decision",
    (tier) => {
      const requirements = NOTICE_OFFERS[tier].blockers;
      expect(canFulfillNoticeOffer(tier, [])).toBe(false);
      expect(canFulfillNoticeOffer(tier, requirements)).toBe(true);
      expect(isNoticeOfferSellable(tier, requirements)).toBe(false);
    },
  );
});
