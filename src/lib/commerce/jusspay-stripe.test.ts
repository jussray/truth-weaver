import { afterEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ from: vi.fn(), getBucket: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: db.from, storage: { getBucket: db.getBucket } } }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
import {
  JUSSPAY_STRIPE_ACCOUNT,
  readJussPayReportProof,
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

  it("requires exact Shopify variants while retaining independent JussPay offer lookup", () => {
    expect(offerForLine("gid://shopify/ProductVariant/68176830562525", "TW-SNAPSHOT-ONE")?.key).toBe("snapshot");
    expect(offerForLine("gid://shopify/ProductVariant/68623865544925", "TW-COURSE-NOTICE")?.key).toBe("course");
    expect(offerForLine("gid://shopify/ProductVariant/68623865643229", "TW-BUNDLE-NOTICE")?.key).toBe("bundle");
    expect(offerForLine(null, "TW-COURSE-NOTICE")).toBeNull();
    expect(offerForLine(undefined, "TW-BUNDLE-NOTICE")).toBeNull();

    // Stripe/JussPay uses an offer key or SKU, not a Shopify variant.
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

describe("central report readiness", () => {
  it("treats permission errors and a public report bucket as not configured", async () => {
    db.from.mockReturnValue({ select: () => ({ limit: async () => ({ error: { code: "42501" } }) }) });
    db.getBucket.mockResolvedValue({ data: { id: "tw-snapshot-reports", public: true }, error: null });
    const readiness = await getPaidReportReadiness();
    expect(readiness.supabase.savedAnalysesTable).toBe(false);
    expect(readiness.supabase.purchaseClaimsTable).toBe(false);
    expect(readiness.supabase.orderReportsTable).toBe(false);
    expect(readiness.supabase.privateReportBucket).toBe(false);
    expect(readiness.isReady).toBe(false);
    expect(readiness.catalog.offers.every((offer) => !offer.deliverableReady)).toBe(true);
  });
  it("never makes a provider request when central verification is disabled", async () => {
    vi.stubEnv("TW_JUSSPAY_REPORTS_ENABLED", "false");
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    expect(await readJussPayReportProof("gid://stripe/CheckoutSession/cs_live_fixture123")).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
  it("uses the fixed central service with no direct Stripe fallback", async () => {
    vi.stubEnv("TW_JUSSPAY_REPORTS_ENABLED", "true");
    vi.stubEnv("TW_JUSSPAY_SERVICE_KEY", "x".repeat(40));
    const request = vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", request);
    expect(await readJussPayReportProof("gid://stripe/CheckoutSession/cs_live_fixture123")).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe("https://jusspay.jussco.company/truthweaver/verify-paid");
    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: "POST", redirect: "error", cache: "no-store" });
  });
});
