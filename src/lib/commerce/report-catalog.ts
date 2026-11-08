/**
 * Paid report catalog. Each offer is a real Shopify product whose deliverable
 * is ONE private PDF prepared from the buyer's own saved notice analysis and
 * tied to the paid Shopify order. Definitions here are not entitlements:
 * access always needs a fresh, server-side Shopify paid-order check.
 *
 * `variantGid` is filled in only after the matching Shopify product exists.
 * A null variant can never match an order line, so it can never unlock a report.
 */
export type ReportKind = "snapshot" | "guide" | "templates" | "course";
export type ReportOfferKey = "snapshot" | "guide" | "templates" | "course" | "bundle";

export type ReportOffer = {
  key: ReportOfferKey;
  sku: string;
  priceUsd: number;
  label: string;
  /** Shopify product_type; matches the shop category filter. */
  productType: "Report" | "Guide" | "Template" | "Course" | "Bundle";
  category: "guides" | "templates" | "courses" | "bundles" | null;
  summary: string;
  includes: readonly string[];
  kinds: readonly ReportKind[];
  variantGid: string | null;
};

export const REPORT_OFFERS: Readonly<Record<ReportOfferKey, ReportOffer>> = {
  snapshot: {
    key: "snapshot",
    sku: "TW-SNAPSHOT-ONE",
    priceUsd: 10,
    label: "Notice Snapshot",
    productType: "Report",
    category: null,
    summary: "A one-page-style PDF summary of the dates, demands and open questions in your saved notice analysis.",
    includes: ["Stated dates and deadlines", "The sender's claimed demands", "Questions to ask a lawyer", "What still needs checking"],
    kinds: ["snapshot"],
    variantGid: "gid://shopify/ProductVariant/68176830562525",
  },
  guide: {
    key: "guide",
    sku: "TW-GUIDE-NOTICE",
    priceUsd: 15,
    label: "Notice Response Guide",
    productType: "Guide",
    category: "guides",
    summary: "A plain-English PDF guide built from your saved notice analysis: your timeline, a step-by-step plan for each demand, how to find the governing law for your place, and questions for a lawyer.",
    includes: ["Your stated-date timeline", "Step-by-step plan for each demand", "How to find the governing law for your place", "Questions to bring to a lawyer"],
    kinds: ["guide"],
    variantGid: null,
  },
  templates: {
    key: "templates",
    sku: "TW-TEMPLATES-NOTICE",
    priceUsd: 12,
    label: "Notice Response Templates",
    productType: "Template",
    category: "templates",
    summary: "Fill-in PDF templates prepared from your saved notice analysis: a deadline tracker, a records log, a neutral request-for-information letter outline, and a lawyer intake sheet.",
    includes: ["Deadline tracker with your stated dates", "Records and communications log", "Request-for-information letter outline", "Lawyer intake sheet"],
    kinds: ["templates"],
    variantGid: null,
  },
  course: {
    key: "course",
    sku: "TW-COURSE-NOTICE",
    priceUsd: 19,
    label: "Notice Basics Course",
    productType: "Course",
    category: "courses",
    summary: "A five-lesson PDF workbook on reading a legal notice, dates and deadlines, finding the governing law, keeping records and getting help, with exercises applied to your saved notice.",
    includes: ["Five short lessons in order", "Exercises using your own notice", "Self-check questions with answers", "Research steps using official sources"],
    kinds: ["course"],
    variantGid: null,
  },
  bundle: {
    key: "bundle",
    sku: "TW-BUNDLE-NOTICE",
    priceUsd: 39,
    label: "Notice Complete Bundle",
    productType: "Bundle",
    category: "bundles",
    summary: "The Notice Snapshot, Response Guide, Response Templates and Basics Course together in one PDF, prepared from your saved notice analysis.",
    includes: ["Notice Snapshot", "Notice Response Guide", "Notice Response Templates", "Notice Basics Course"],
    kinds: ["snapshot", "guide", "templates", "course"],
    variantGid: null,
  },
};

export const REPORT_OFFER_KEYS = Object.keys(REPORT_OFFERS) as ReportOfferKey[];

/** Cart attribute that carries the server-issued purchase claim. Underscore keeps it out of the checkout UI. */
export const CLAIM_ATTRIBUTE_KEY = "_tw_claim";
/** Session-only pointer to the most recently opted-in, server-saved analysis. */
export const SAVED_ANALYSIS_SESSION_KEY = "tw.paid-analysis-id.v1";
export const CLAIM_NONCE = /^[A-Za-z0-9_-]{43}$/;

/** Exact variant + SKU match against a created Shopify product. */
export function offerForLine(variantGid: string | null | undefined, sku: string | null | undefined): ReportOffer | null {
  if (!variantGid || !sku) return null;
  for (const offer of Object.values(REPORT_OFFERS)) {
    if (offer.variantGid !== null && offer.variantGid === variantGid && offer.sku === sku) return offer;
  }
  return null;
}

/** True when a cart line is a report product that needs a saved analysis before checkout. */
export function isReportVariant(variantGid: string): boolean {
  return Object.values(REPORT_OFFERS).some((offer) => offer.variantGid !== null && offer.variantGid === variantGid);
}

/** Ordered, de-duplicated report parts for the purchased offers. */
export function reportKindsFor(offers: readonly ReportOfferKey[]): ReportKind[] {
  const order: ReportKind[] = ["snapshot", "guide", "templates", "course"];
  const wanted = new Set(offers.flatMap((key) => REPORT_OFFERS[key]?.kinds ?? []));
  return order.filter((kind) => wanted.has(kind));
}

export function offerLabels(offers: readonly string[]): string[] {
  return offers.flatMap((key) => (key in REPORT_OFFERS ? [REPORT_OFFERS[key as ReportOfferKey].label] : []));
}
