import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MERCHANT_AUDIT_OUTCOMES } from "./audit-contract";
import { canSetStatus, confirmationPhrase, redactOrder, validatePrice, variantBelongsToProduct } from "./policy";

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

describe("merchant catalog identity checks", () => {
  const variant = "gid://shopify/ProductVariant/25";
  const product = "gid://shopify/Product/12";

  it("allows a variant only when Shopify's variant and parent product IDs both match", () => {
    expect(variantBelongsToProduct(variant, product, variant, product)).toBe(true);
  });

  it("denies cross-product IDs and different variant IDs", () => {
    expect(variantBelongsToProduct(variant, product, variant, "gid://shopify/Product/13")).toBe(false);
    expect(variantBelongsToProduct(variant, product, "gid://shopify/ProductVariant/26", product)).toBe(false);
  });

  it("fails closed for malformed readback identities", () => {
    expect(variantBelongsToProduct("invalid", product, variant, product)).toBe(false);
    expect(variantBelongsToProduct(variant, "invalid", variant, product)).toBe(false);
  });
});

describe("merchant audit database contract", () => {
  it("uses only outcomes accepted by the committed Supabase migration", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20261014030242_cef5eec2-77b7-4df1-b280-52f1f1e02784.sql"),
      "utf8",
    );
    const constraint = migration.match(/outcome\s+text\s+not\s+null\s+check\s*\(\s*outcome\s+in\s*\(([^)]+)\)\s*\)/i);
    expect(constraint, "merchant_audit_log.outcome CHECK constraint must exist").not.toBeNull();
    const sqlAllowedValues = constraint?.[1];
    if (!sqlAllowedValues) throw new Error("No merchant audit CHECK constraint outcomes found");
    const databaseOutcomes = [...sqlAllowedValues.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
    expect([...MERCHANT_AUDIT_OUTCOMES].sort()).toEqual(databaseOutcomes);
    expect(MERCHANT_AUDIT_OUTCOMES).not.toContain("unverified");
  });
});
