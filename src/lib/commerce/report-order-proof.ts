import { CLAIM_ATTRIBUTE_KEY, CLAIM_NONCE, offerForLine, type ReportOfferKey } from "./report-catalog";
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
  | "insufficient_item_payment";

export type ReportProofDecision =
  | { granted: true; orderId: string; orderName: string; createdAt: string; offers: ReportOfferKey[]; claimNonce: string }
  | { granted: false; reason: ReportProofDenial };

export const ORDER_GID = /^gid:\/\/shopify\/Order\/[1-9][0-9]{0,19}$/;

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
