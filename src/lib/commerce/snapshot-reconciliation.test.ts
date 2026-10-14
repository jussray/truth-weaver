import { describe, expect, it } from "vitest";
import { selectPaidSnapshots, type CustomerOrdersPage } from "./snapshot-reconciliation";
import type { ShopifyOrderForProof } from "./shopify-order-proof";

const customerId = "gid://shopify/Customer/12345";
function paidOrder(id: string): ShopifyOrderForProof {
  return {
    id, test: false, cancelledAt: null, fullyPaid: true, displayFinancialStatus: "PAID",
    currencyCode: "USD", customer: { id: customerId },
    totalRefundedSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } },
    totalOutstandingSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } },
    lineItems: { pageInfo: { hasNextPage: false }, edges: [{
      node: {
        id: "gid://shopify/LineItem/1", sku: "TW-SNAPSHOT-ONE", currentQuantity: 1,
        variant: { id: "gid://shopify/ProductVariant/68176830562525" },
        discountedUnitPriceAfterAllDiscountsSet: { shopMoney: { amount: "10.00", currencyCode: "USD" } },
      },
    }] },
  };
}
function page(orders: ShopifyOrderForProof[]): CustomerOrdersPage {
  return { id: customerId, orders: { pageInfo: { hasNextPage: false }, edges: orders.map(node => ({ node })) } };
}

describe("Shopify Snapshot purchase reconciliation", () => {
  it("selects only paid, non-test, non-refunded, correctly owned Snapshot orders", () => {
    const normal = paidOrder("gid://shopify/Order/111");
    const test = { ...paidOrder("gid://shopify/Order/222"), test: true };
    const unpaid = { ...paidOrder("gid://shopify/Order/333"), fullyPaid: false };
    const refunded = { ...paidOrder("gid://shopify/Order/444"),
      totalRefundedSet: { shopMoney: { amount: "10.00", currencyCode: "USD" } } };
    const other = { ...paidOrder("gid://shopify/Order/555"), customer: { id: "gid://shopify/Customer/999" } };
    const wrongSku = { ...paidOrder("gid://shopify/Order/666"), lineItems: {
      pageInfo: { hasNextPage: false }, edges: [],
    } };
    expect(selectPaidSnapshots(page([normal, test, unpaid, refunded, other, wrongSku]), customerId))
      .toEqual({ valid: true, paidSnapshotOrderIds: ["gid://shopify/Order/111"] });
  });
  it("fails closed on mismatched buyer, missing orders or pagination", () => {
    expect(selectPaidSnapshots(null, customerId)).toEqual({ valid: false, reason: "unverified_customer" });
    expect(selectPaidSnapshots(page([]), "gid://shopify/Customer/42")).toEqual({ valid: false, reason: "unverified_customer" });
    expect(selectPaidSnapshots({ ...page([]), orders: null }, customerId))
      .toEqual({ valid: false, reason: "incomplete_orders" });
    expect(selectPaidSnapshots({
      ...page([]), orders: { pageInfo: { hasNextPage: true }, edges: [] },
    }, customerId)).toEqual({ valid: false, reason: "incomplete_orders" });
  });
  it("rejects a $9.99 line for a $10 Snapshot", () => {
    const underpaid = paidOrder("gid://shopify/Order/111");
    underpaid.lineItems!.edges[0].node.discountedUnitPriceAfterAllDiscountsSet!.shopMoney.amount = "9.99";
    expect(selectPaidSnapshots(page([underpaid]), customerId))
      .toEqual({ valid: true, paidSnapshotOrderIds: [] });
  });
});
