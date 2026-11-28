import { describe, expect, it } from "vitest";
import { hasPrivateReportStorage, readinessTableProbeSucceeded } from "./paid-report-readiness.server";
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

describe("Truth Weaver paid-report readiness evidence gates", () => {
  it("treats only a successful database probe as proof of table visibility", () => {
    expect(readinessTableProbeSucceeded(null)).toBe(true);
    expect(readinessTableProbeSucceeded({ code: "42P01" })).toBe(false);
    expect(readinessTableProbeSucceeded({ code: "PGRST301" })).toBe(false);
    expect(readinessTableProbeSucceeded({ code: "08006" })).toBe(false);
  });

  it("recognizes only the real private PDF bucket, never a public or misnamed bucket", () => {
    expect(hasPrivateReportStorage({ id: "tw-snapshot-reports", public: false })).toBe(true);
    expect(hasPrivateReportStorage({ id: "tw-snapshot-reports", public: true })).toBe(false);
    expect(hasPrivateReportStorage({ id: "snapshot-reports", public: false })).toBe(false);
    expect(hasPrivateReportStorage(undefined)).toBe(false);
    expect(hasPrivateReportStorage(null)).toBe(false);
  });
});

describe("merchant launch holds cover every paid report SKU", () => {
  it.each([
    "TW-SNAPSHOT-ONE", "TW-DEEPDIVE-ONE", "TW-PREMIUM-ONE",
    "TW-GUIDE-NOTICE", "TW-TEMPLATES-NOTICE",
    "TW-COURSE-NOTICE", "TW-BUNDLE-NOTICE",
  ])("protects newly created paid report products: %s", (sku) => {
    expect(canSetStatus("ACTIVE", [sku]).allowed).toBe(false);
    expect(canSetStatus("DRAFT", [sku]).allowed).toBe(true);
  });
});
