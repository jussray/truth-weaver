import { NOTICE_OFFERS } from "../notice-offers";
import { REPORT_OFFERS } from "../commerce/report-catalog";

/** Pure merchant-portal guards. No I/O. Server functions must call these before any Shopify write. */

export const PRODUCT_GID = /^gid:\/\/shopify\/Product\/[1-9][0-9]*$/;
export const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
export const ORDER_GID = /^gid:\/\/shopify\/Order\/[1-9][0-9]*$/;
export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

/** SKUs that may never be activated until paid-order AND delivery proof exist. */
export const LAUNCH_HOLD_SKUS: readonly string[] = [
  ...new Set([
    ...Object.values(NOTICE_OFFERS).filter((o) => !o.readyForSale).map((o) => o.sku),
    // All personalized report SKUs remain held until exact live buyer-to-PDF proof.
    ...Object.values(REPORT_OFFERS).map((o) => o.sku),
  ]),
];

export function validatePrice(price: string): string | null {
  if (!/^(?:0|[1-9][0-9]{0,5})\.[0-9]{2}$/.test(price)) return null;
  const n = Number(price);
  return n >= 0.5 && n <= 10000 ? price : null;
}

export type StatusDecision = { allowed: true } | { allowed: false; reason: string };

export function canSetStatus(next: ProductStatus, variantSkus: readonly (string | null)[]): StatusDecision {
  if (next !== "ACTIVE") return { allowed: true };
  const held = variantSkus.find((s) => s && LAUNCH_HOLD_SKUS.includes(s));
  if (held) return { allowed: false, reason: `${held} is on launch hold until paid-order and delivery proof exist.` };
  return { allowed: true };
}

/** Exact-phrase confirmation the merchant must type; binds the confirmation to the specific change. */
export function confirmationPhrase(action: "price" | "status", target: string, value: string): string {
  return `${action.toUpperCase()} ${target.split("/").pop()} ${value}`;
}

/** Price threshold above which a one-click confirm is not enough. */
export const HIGH_IMPACT_CHANGE = 0.25;

/**
 * High-impact price changes (any decrease, or a move of more than 25%)
 * require the typed confirmation phrase. Routine raises are one-click.
 */
export function requiresTypedConfirmation(before: string, after: string): boolean {
  const b = Number(before);
  const a = Number(after);
  if (!Number.isFinite(b) || b <= 0) return true;
  if (a < b) return true;
  return Math.abs(a - b) / b > HIGH_IMPACT_CHANGE;
}

/** Human message shown after a successful change; must name the exact change. */
export function priceChangeMessage(variantTitle: string, before: string, after: string): string {
  return `Price for ${variantTitle} changed from $${before} to $${after}.`;
}

type RawOrder = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  test: boolean;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  customer?: unknown;
  email?: unknown;
  shippingAddress?: unknown;
};

/** Strips all customer PII. Only order-level operational fields cross to the browser. */
export function redactOrder(o: RawOrder) {
  return {
    id: o.id,
    name: o.name,
    createdAt: o.createdAt,
    financialStatus: o.displayFinancialStatus,
    fulfillmentStatus: o.displayFulfillmentStatus,
    test: o.test,
    total: o.totalPriceSet.shopMoney,
  };
}
