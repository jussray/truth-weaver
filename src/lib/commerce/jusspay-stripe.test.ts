import { describe, expect, it } from "vitest";
import {
  JUSSPAY_STRIPE_ACCOUNT,
  verifyStripeWebhookSignature,
} from "./jusspay-stripe.server";
import {
  REPORT_OFFERS,
  offerForLine,
  offerForJussPay,
  reportKindsFor,
} from "./report-catalog";
import { getPaidReportReadiness } from "@/lib/merchant/paid-report-readiness.server";

describe("JussPay Stripe Core & Multi-product Catalog", () => {
  it("binds to canonical JussPay Stripe account", () => {
    expect(JUSSPAY_STRIPE_ACCOUNT).toBe("acct_1U4xNyRs4gw4sfJH");
  });

  it("verifies multi-product catalog definitions", () => {
    expect(REPORT_OFFERS.snapshot.priceUsd).toBe(10);
    expect(REPORT_OFFERS.guide.priceUsd).toBe(15);
    expect(REPORT_OFFERS.templates.priceUsd).toBe(12);
    expect(REPORT_OFFERS.course.priceUsd).toBe(19);
    expect(REPORT_OFFERS.bundle.priceUsd).toBe(39);

    expect(reportKindsFor(["bundle"])).toEqual(["snapshot", "guide", "templates", "course"]);
  });

  it("requires exact pinned variants and SKUs for created Shopify offers", () => {
    // Snapshot has pinned variant
    const snap = offerForLine("gid://shopify/ProductVariant/68176830562525", "TW-SNAPSHOT-ONE");
    expect(snap?.key).toBe("snapshot");

    // Course matches via SKU
    const course = offerForLine(REPORT_OFFERS.course.variantGid, "TW-COURSE-NOTICE");
    expect(course?.key).toBe("course");
    expect(offerForLine(null, "TW-COURSE-NOTICE")).toBeNull();

    // Bundle matches via SKU
    const bundle = offerForLine(REPORT_OFFERS.bundle.variantGid, "TW-BUNDLE-NOTICE");
    expect(bundle?.key).toBe("bundle");
    expect(offerForLine("gid://shopify/ProductVariant/unknown", "TW-BUNDLE-NOTICE")).toBeNull();

    // JussPay direct resolution
    expect(offerForJussPay("course")?.sku).toBe("TW-COURSE-NOTICE");
    expect(offerForJussPay("TW-BUNDLE-NOTICE")?.key).toBe("bundle");
  });

  it("rejects invalid Stripe webhook signatures fail-closed", async () => {
    const raw = JSON.stringify({ type: "checkout.session.completed" });
    const verified = await verifyStripeWebhookSignature(raw, "t=123,v1=bad_sig", "whsec_testsecret");
    expect(verified).toBe(false);

    // Missing secret
    const missingSecret = await verifyStripeWebhookSignature(raw, "t=123,v1=bad_sig", undefined);
    expect(missingSecret).toBe(false);
  });

  it("readiness evaluator never serializes secret values", async () => {
    const readiness = await getPaidReportReadiness();
    const serialized = JSON.stringify(readiness);

    expect(serialized).not.toContain("sk_");
    expect(serialized).not.toContain("whsec_");
    expect(serialized).not.toContain("shpat_");
    expect(readiness.stripe.account).toBe("acct_1U4xNyRs4gw4sfJH");
    expect(readiness.catalog.totalOffers).toBe(5);
  });
});
