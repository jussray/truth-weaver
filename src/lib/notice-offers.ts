/** Founder-approved commercial proposal. These definitions are NOT purchase entitlements. */
export const NOTICE_OFFERS = {
  snapshot: {
    sku: "TW-SNAPSHOT-ONE",
    priceUsd: 10,
    label: "Notice Snapshot",
    description: "Downloadable source-bound notice summary",
    delivery: "report_download",
    readyForSale: false,
    blockers: ["report-export", "shopify-paid-order-proof", "verified-delivery"],
  },
  deepDive: {
    sku: "TW-DEEPDIVE-ONE",
    priceUsd: 29,
    label: "Notice Deep Dive",
    description: "Expanded interactive notice review and verified source trail when available",
    delivery: "interactive_access",
    readyForSale: false,
    blockers: ["paid-entitlement", "bounded-followups", "verified-source-retrieval", "verified-delivery"],
  },
  premium: {
    sku: "TW-PREMIUM-ONE",
    priceUsd: 49,
    label: "Notice Premium",
    description: "Multi-round research packet with revised downloadable report",
    delivery: "interactive_access_and_report",
    readyForSale: false,
    blockers: ["paid-entitlement", "multi-round-limits", "report-export", "source-provenance", "verified-delivery"],
  },
} as const;

export type NoticeOffer = keyof typeof NOTICE_OFFERS;

export function canFulfillNoticeOffer(
  offer: NoticeOffer,
  passedGates: readonly string[],
): boolean {
  const required = NOTICE_OFFERS[offer].blockers;
  return required.every((gate) => passedGates.includes(gate));
}

/** Do not equate test gate completion with paid production readiness. */
export function isNoticeOfferSellable(
  offer: NoticeOffer,
  passedGates: readonly string[],
): boolean {
  return NOTICE_OFFERS[offer].readyForSale && canFulfillNoticeOffer(offer, passedGates);
}
