/**
 * HTTP status for an orders/paid delivery that did not record an entitlement.
 *
 * Shopify treats any 2xx as delivered and never retries it, and it retries
 * non-2xx responses about eight times over roughly four hours. So 202 is only
 * correct for a deliberate, permanent non-grant. Anything that could resolve
 * later (missing Admin token, Admin or network failure, unbound customer, guest
 * checkout, database error, unclear payment state) must return 503 so Shopify
 * retries it and the failure stays visible in its delivery logs.
 */
const PERMANENT_NON_GRANTS: ReadonlySet<string> = new Set([
  "test_order",
  "wrong_product",
  "wrong_currency",
  "order_cancelled_or_refunded",
]);

export function ungrantedStatus(reason: string): 202 | 503 {
  return PERMANENT_NON_GRANTS.has(reason) ? 202 : 503;
}
