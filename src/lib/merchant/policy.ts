import { NOTICE_OFFERS } from "../notice-offers";

/** Pure merchant-portal guards. No I/O. Server functions must call these before any Shopify write. */

export const PRODUCT_GID = /^gid:\/\/shopify\/Product\/[1-9][0-9]*$/;
export const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

/** SKUs that may never be activated until paid-order AND delivery proof exist. */
export const LAUNCH_HOLD_SKUS: readonly string[] = Object.values(NOTICE_OFFERS)
  .filter((o) => !o.readyForSale)
  .map((o) => o.sku);

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
