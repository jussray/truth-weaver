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

import { priceChangeMessage, requiresTypedConfirmation } from "./policy";

describe("price confirmation tiers", () => {
  it("routine raise up to 25% is one-click", () => {
    expect(requiresTypedConfirmation("10.00", "12.50")).toBe(false);
  });
  it("raise over 25% needs the typed phrase", () => {
    expect(requiresTypedConfirmation("10.00", "12.51")).toBe(true);
  });
  it("any price decrease needs the typed phrase", () => {
    expect(requiresTypedConfirmation("10.00", "9.99")).toBe(true);
  });
  it("confirmation message names the exact change", () => {
    expect(priceChangeMessage("Snapshot — Default", "10.00", "12.00")).toBe(
      "Price for Snapshot — Default changed from $10.00 to $12.00.",
    );
  });
});
