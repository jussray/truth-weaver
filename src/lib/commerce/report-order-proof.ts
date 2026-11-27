import { CLAIM_ATTRIBUTE_KEY, CLAIM_NONCE, REPORT_OFFERS, offerForLine, type ReportOfferKey } from "./report-catalog";
import { usdCents } from "./shopify-order-proof";

/**
 * Pure evaluators for paid report orders. The order MUST come from a fresh,
 * authenticated Shopify Admin read; webhook bodies, checkout return URLs and
 * browser state are never proof of payment.
 */
type Money = { amount: string; currencyCode: string };

export type ReportOrderForProof = {
  id: string;
  name: string;
  createdAt: string;
  test: boolean;
  cancelledAt: string | null;
  fullyPaid: boolean;
  displayFinancialStatus: string | null;
  currencyCode: string;
  customAttributes: Array<{ key: string; value: string | null }> | null;
  totalRefundedSet: { shopMoney: Money } | null;
  totalOutstandingSet: { shopMoney: Money } | null;
  lineItems: {
    pageInfo: { hasNextPage: boolean };
    edges: Array<{
      node: {
        id: string;
        sku: string | null;
        currentQuantity: number;
        variant: { id: string } | null;
        discountedUnitPriceAfterAllDiscountsSet: { shopMoney: Money } | null;
      };
    }>;
  } | null;
};

export type ReportProofDenial =
  | "missing_proof"
  | "test_order"
  | "order_cancelled_or_refunded"
  | "wrong_currency"
  | "order_not_paid"
  | "order_lines_incomplete"
  | "no_claim"
  | "wrong_product"
  | "insufficient_item_payment"
  | "invalid_quantity";

export type ReportProofDecision =
  | { granted: true; orderId: string; orderName: string; createdAt: string; offers: ReportOfferKey[]; claimNonce: string; buyer?: { userId: string; analysisId: string } }
  | { granted: false; reason: ReportProofDenial };

export const ORDER_GID = /^gid:\/\/shopify\/Order\/[1-9][0-9]{0,19}$/;

export const STRIPE_REPORT_ORDER_GID = /^gid:\/\/stripe\/CheckoutSession\/cs_live_[A-Za-z0-9_]{1,180}$/;
export const REPORT_ORDER_GID = /^(?:gid:\/\/shopify\/Order\/[1-9][0-9]{0,19}|gid:\/\/stripe\/CheckoutSession\/cs_live_[A-Za-z0-9_]{1,180})$/;

/** Accept only the bounded response of the server-owned JussPay verification port. */
export function evaluateJussPayReportProof(value: unknown, orderGid: string): ReportProofDecision {
  const deny = { granted: false, reason: "missing_proof" } as const;
  if (!STRIPE_REPORT_ORDER_GID.test(orderGid) || !value || typeof value !== "object" || Array.isArray(value)) return deny;
  const p = value as Record<string, unknown>;
  if (p['schema'] !== "jusspay/truthweaver-paid-proof@v1" || p['paid'] !== true ||
      p['sessionId'] !== orderGid.split("/").pop() || p['currency'] !== "usd" ||
      typeof p['offerKey'] !== "string" || !Object.hasOwn(REPORT_OFFERS, p['offerKey']) ||
      typeof p['userId'] !== "string" || !UUID.test(p['userId']) ||
      typeof p['analysisId'] !== "string" || !UUID.test(p['analysisId']) ||
      typeof p['claimNonce'] !== "string" || !CLAIM_NONCE.test(p['claimNonce']) ||
      typeof p['createdAt'] !== "string" || !Number.isFinite(Date.parse(p['createdAt']))) return deny;
  const offer = REPORT_OFFERS[p['offerKey'] as ReportOfferKey];
  if (p['amountTotalMinor'] !== offer.priceUsd * 100) return deny;
  return { granted: true, orderId: orderGid, orderName: "Stripe " + String(p['sessionId']).slice(-8).toUpperCase(),
    createdAt: p['createdAt'], offers: [offer.key], claimNonce: p['claimNonce'],
    buyer: { userId: p['userId'], analysisId: p['analysisId'] } };
}

/** Returns the single claim nonce on the order, or null when absent, duplicated or malformed. */
export function claimNonceFrom(attributes: ReportOrderForProof["customAttributes"]): string | null {
  if (!Array.isArray(attributes)) return null;
  const values = attributes.filter((a) => a?.key === CLAIM_ATTRIBUTE_KEY).map((a) => a.value ?? "");
  if (values.length !== 1) return null;
  const nonce = values[0] ?? "";
  return CLAIM_NONCE.test(nonce) ? nonce : null;
}

export function evaluatePaidReportOrder(order: ReportOrderForProof | null): ReportProofDecision {
  const deny = (reason: ReportProofDenial): ReportProofDecision => ({ granted: false, reason });
  if (!order || !ORDER_GID.test(order.id) || typeof order.name !== "string" ||
      order.name.length < 1 || order.name.length > 40 || !Number.isFinite(Date.parse(order.createdAt))) return deny("missing_proof");
  if (order.test !== false) return deny("test_order");
  if (order.cancelledAt !== null ||
      usdCents(order.totalRefundedSet?.shopMoney.amount ?? "") !== 0 ||
      order.totalRefundedSet?.shopMoney.currencyCode !== "USD") return deny("order_cancelled_or_refunded");
  if (order.currencyCode !== "USD" || order.totalOutstandingSet?.shopMoney.currencyCode !== "USD") return deny("wrong_currency");
  if (order.fullyPaid !== true || order.displayFinancialStatus !== "PAID" ||
      usdCents(order.totalOutstandingSet?.shopMoney.amount ?? "") !== 0) return deny("order_not_paid");
  if (!order.lineItems || order.lineItems.pageInfo.hasNextPage !== false ||
      !Array.isArray(order.lineItems.edges)) return deny("order_lines_incomplete");

  const claimNonce = claimNonceFrom(order.customAttributes);
  if (!claimNonce) return deny("no_claim");

  const offers = new Set<ReportOfferKey>();
  for (const { node } of order.lineItems.edges) {
    const offer = offerForLine(node.variant?.id, node.sku);
    if (!offer || node.currentQuantity <= 0) continue;
    // Each personalized report is generated once per order, never once per unit.
    // Block duplicate line items/quantities so buyers are not charged repeatedly
    // for a single generated document.
    if (node.currentQuantity !== 1 || offers.has(offer.key)) return deny("invalid_quantity");
    const paid = node.discountedUnitPriceAfterAllDiscountsSet?.shopMoney;
    const cents = usdCents(paid?.amount ?? "");
    // A discounted or underpaid report line denies the whole order rather than guessing.
    if (paid?.currencyCode !== "USD" || cents === null || cents < offer.priceUsd * 100) return deny("insufficient_item_payment");
    offers.add(offer.key);
  }
  if (offers.size === 0) return deny("wrong_product");
  return { granted: true, orderId: order.id, orderName: order.name, createdAt: order.createdAt, offers: [...offers], claimNonce };
}

export type StoredClaim = {
  nonce: string;
  userId: string;
  analysisId: string;
  createdAt: string;
  expiresAt: string;
  consumedOrderGid: string | null;
};

export type ClaimDenial = "claim_missing" | "claim_mismatch" | "claim_expired" | "claim_used";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Orders may be created slightly before the server clock records the claim. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** A claim binds one order to one account + saved analysis. It never proves payment. */
export function validateClaimForOrder(
  claim: StoredClaim | null,
  proof: Extract<ReportProofDecision, { granted: true }>,
): { ok: true } | { ok: false; reason: ClaimDenial } {
  if (!claim) return { ok: false, reason: "claim_missing" };
  if (claim.nonce !== proof.claimNonce || !UUID.test(claim.userId) || !UUID.test(claim.analysisId)) {
    return { ok: false, reason: "claim_mismatch" };
  }
  if (STRIPE_REPORT_ORDER_GID.test(proof.orderId) &&
      (!proof.buyer || proof.buyer.userId !== claim.userId || proof.buyer.analysisId !== claim.analysisId)) {
    return { ok: false, reason: "claim_mismatch" };
  }
  const created = Date.parse(claim.createdAt);
  const expires = Date.parse(claim.expiresAt);
  const ordered = Date.parse(proof.createdAt);
  if (!Number.isFinite(created) || !Number.isFinite(expires) || !Number.isFinite(ordered)) {
    return { ok: false, reason: "claim_mismatch" };
  }
  if (ordered + CLOCK_SKEW_MS < created || ordered > expires) return { ok: false, reason: "claim_expired" };
  if (claim.consumedOrderGid !== null && claim.consumedOrderGid !== proof.orderId) return { ok: false, reason: "claim_used" };
  return { ok: true };
}
