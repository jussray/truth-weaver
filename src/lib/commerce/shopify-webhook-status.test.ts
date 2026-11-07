import { describe, expect, it } from "vitest";
import { ungrantedStatus } from "./shopify-webhook-status";

describe("orders/paid ungranted status", () => {
  it("acknowledges only deliberate, permanent non-grants with 202", () => {
    for (const reason of ["test_order", "wrong_product", "wrong_currency", "order_cancelled_or_refunded"]) {
      expect(ungrantedStatus(reason)).toBe(202);
    }
  });

  it("returns 503 for anything that may resolve later so Shopify retries it", () => {
    for (const reason of [
      "missing_proof",
      "customer_not_bound",
      "order_not_paid",
      "order_lines_incomplete",
      "not_verifiable",
      "unavailable",
      "some_unknown_reason",
    ]) {
      expect(ungrantedStatus(reason)).toBe(503);
    }
  });
});
