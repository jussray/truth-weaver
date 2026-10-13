import { NOTICE_OFFERS, type NoticeOffer } from "../notice-offers";

/**
 * Strict matching against the founder's actual, currently DRAFT Shopify variants.
 * A Shopify customer ID must be obtained from a SERVER-VERIFIED customer binding.
 * Never treat a client-supplied email, order ID, cart ID, session flag or
 * continuity cookie as customer ownership or proof of payment.
 */
export const TRUTH_WEAVER_SHOPIFY_DOMAIN = "fcr-truth-weaver-esimv-203acj81.myshopify.com";

export const NOTICE_VARIANTS: Record<NoticeOffer, string> = {
  snapshot: "gid://shopify/ProductVariant/68176830562525",
  deepDive: "gid://shopify/ProductVariant/68177215324381",
  premium: "gid://shopify/ProductVariant/68177215881437",
};

type Money = { amount: string; currencyCode: string };
export type ShopifyOrderForProof = {
  id: string;
  test: boolean;
  cancelledAt: string | null;
  fullyPaid: boolean;
  displayFinancialStatus: string | null;
  currencyCode: string;
  customer: { id: string } | null;
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

export type PaymentProofDecision =
  | { granted: true; orderId: string; variantId: string; offer: NoticeOffer }
  | {
      granted: false;
      reason:
        | "missing_proof"
        | "customer_not_bound"
        | "order_not_paid"
        | "order_cancelled_or_refunded"
        | "test_order"
        | "wrong_currency"
        | "order_lines_incomplete"
        | "wrong_product"
        | "insufficient_item_payment";
    };

/** Returns null on unsupported numbers: no floats, NaN, scientific notation or rounding. */
export function usdCents(value: string): number | null {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value)) return null;
  const [whole, fractional = ""] = value.split(".");
  const units = Number(whole);
  const cents = Number(fractional.padEnd(2, "0"));
  const result = units * 100 + cents;
  return Number.isSafeInteger(result) ? result : null;
}

/** Pure evaluator. The order MUST come from a fresh authenticated Shopify Admin read. */
export function evaluatePaidNoticeOrder(
  order: ShopifyOrderForProof | null,
  offer: NoticeOffer,
  trustedShopifyCustomerId: string | null,
): PaymentProofDecision {
  const deny = (reason: Extract<PaymentProofDecision, { granted: false }>["reason"]): PaymentProofDecision =>
    ({ granted: false, reason });

  if (!order || !/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/.test(order.id)) return deny("missing_proof");
  if (!trustedShopifyCustomerId || !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(trustedShopifyCustomerId) ||
      order.customer?.id !== trustedShopifyCustomerId) return deny("customer_not_bound");
  if (order.test !== false) return deny("test_order");
  if (order.cancelledAt !== null ||
      usdCents(order.totalRefundedSet?.shopMoney.amount ?? "") !== 0 ||
      order.totalRefundedSet?.shopMoney.currencyCode !== "USD") return deny("order_cancelled_or_refunded");
  if (order.currencyCode !== "USD" ||
      order.totalOutstandingSet?.shopMoney.currencyCode !== "USD") return deny("wrong_currency");
  if (order.fullyPaid !== true || order.displayFinancialStatus !== "PAID" ||
      usdCents(order.totalOutstandingSet?.shopMoney.amount ?? "") !== 0) return deny("order_not_paid");
  if (!order.lineItems || order.lineItems.pageInfo.hasNextPage !== false ||
      !Array.isArray(order.lineItems.edges)) return deny("order_lines_incomplete");

  const required = NOTICE_OFFERS[offer];
  const matching = order.lineItems.edges.filter(({ node }) =>
    node.variant?.id === NOTICE_VARIANTS[offer] && node.sku === required.sku && node.currentQuantity > 0
  );
  if (matching.length !== 1) return deny("wrong_product");
  const amount = matching[0]?.node.discountedUnitPriceAfterAllDiscountsSet?.shopMoney;
  const paidCents = usdCents(amount?.amount ?? "");
  if (amount?.currencyCode !== "USD" || paidCents === null ||
      paidCents < required.priceUsd * 100) return deny("insufficient_item_payment");
  return { granted: true, orderId: order.id, variantId: NOTICE_VARIANTS[offer], offer };
}
