import { describe, expect, it } from "vitest";
import { canSetStatus, confirmationPhrase, redactOrder, validatePrice } from "./policy";

describe("merchant policy", () => {
  it("blocks activating launch-hold Snapshot", () => {
    expect(canSetStatus("ACTIVE", ["TW-SNAPSHOT-ONE"]).allowed).toBe(false);
    expect(canSetStatus("DRAFT", ["TW-SNAPSHOT-ONE"]).allowed).toBe(true);
    expect(canSetStatus("ACTIVE", ["OTHER-SKU"]).allowed).toBe(true);
  });
  it("validates prices strictly", () => {
    expect(validatePrice("10.00")).toBe("10.00");
    for (const bad of ["10", "1e2", "-1.00", "0.10", "10.001", "99999.00 ", ""]) expect(validatePrice(bad)).toBeNull();
  });
  it("binds confirmation to target and value", () => {
    expect(confirmationPhrase("price", "gid://shopify/ProductVariant/12", "29.00")).toBe("PRICE 12 29.00");
  });
  it("redacts customer PII from orders", () => {
    const out = redactOrder({
      id: "gid://shopify/Order/1", name: "#1001", createdAt: "x", displayFinancialStatus: "PAID",
      displayFulfillmentStatus: "UNFULFILLED", test: false,
      totalPriceSet: { shopMoney: { amount: "10.00", currencyCode: "USD" } },
      customer: { email: "a@b.c" }, email: "a@b.c", shippingAddress: { address1: "1 St" },
    });
    expect(JSON.stringify(out)).not.toMatch(/a@b\.c|1 St/);
  });
});
