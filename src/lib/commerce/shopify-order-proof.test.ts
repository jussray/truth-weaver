import { afterEach, describe, expect, it, vi } from "vitest";
import { NOTICE_VARIANTS, evaluatePaidNoticeOrder, usdCents, type ShopifyOrderForProof } from "./shopify-order-proof";
import { verifyFreshTruthWeaverPurchase } from "./shopify-order.server";
import { shopifyAdminAccessToken } from "../merchant/admin.server";

afterEach(() => vi.unstubAllEnvs());

const customerId = "gid://shopify/Customer/12345";
const orderId = "gid://shopify/Order/67890";
const order: ShopifyOrderForProof = {
  id: orderId,
  test: false,
  cancelledAt: null,
  fullyPaid: true,
  displayFinancialStatus: "PAID",
  currencyCode: "USD",
  customer: { id: customerId },
  totalRefundedSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } },
  totalOutstandingSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } },
  lineItems: {
    pageInfo: { hasNextPage: false },
    edges: [{
      node: {
        id: "gid://shopify/LineItem/567",
        sku: "TW-SNAPSHOT-ONE",
        currentQuantity: 1,
        variant: { id: NOTICE_VARIANTS.snapshot },
        discountedUnitPriceAfterAllDiscountsSet: { shopMoney: { amount: "10.00", currencyCode: "USD" } },
      },
    }],
  },
};

function withChanges(change: (copy: ShopifyOrderForProof) => void) {
  const copy = structuredClone(order);
  change(copy);
  return copy;
}

describe("Shopify order proof (no buyer download is unlocked)", () => {
  it("accepts only a full, recent-context Shopify paid-order fact set", () => {
    expect(evaluatePaidNoticeOrder(order, "snapshot", customerId)).toEqual({
      granted: true, orderId, variantId: NOTICE_VARIANTS.snapshot, offer: "snapshot",
    });
    expect(evaluatePaidNoticeOrder(order, "deepDive", customerId)).toEqual({
      granted: false, reason: "wrong_product",
    });
  });

  it.each([
    ["unknown order", null, "missing_proof"],
    ["test order", withChanges((o) => { o.test = true; }), "test_order"],
    ["unpaid", withChanges((o) => { o.fullyPaid = false; }), "order_not_paid"],
    ["authorized only", withChanges((o) => { o.displayFinancialStatus = "AUTHORIZED"; }), "order_not_paid"],
    ["cancelled", withChanges((o) => { o.cancelledAt = "2026-10-13T12:00:00Z"; }), "order_cancelled_or_refunded"],
    ["refunded", withChanges((o) => { o.totalRefundedSet!.shopMoney.amount = "1.00"; }), "order_cancelled_or_refunded"],
    ["outstanding", withChanges((o) => { o.totalOutstandingSet!.shopMoney.amount = "5.00"; }), "order_not_paid"],
    ["non-USD currency", withChanges((o) => { o.currencyCode = "CAD"; }), "wrong_currency"],
    ["incomplete lines", withChanges((o) => { o.lineItems!.pageInfo.hasNextPage = true; }), "order_lines_incomplete"],
    ["wrong variant", withChanges((o) => { o.lineItems!.edges[0]!.node.variant!.id = NOTICE_VARIANTS.deepDive; }), "wrong_product"],
    ["wrong SKU", withChanges((o) => { o.lineItems!.edges[0]!.node.sku = "TW-OTHER"; }), "wrong_product"],
    ["removed/refunded line", withChanges((o) => { o.lineItems!.edges[0]!.node.currentQuantity = 0; }), "wrong_product"],
    ["discounted to free", withChanges((o) => { o.lineItems!.edges[0]!.node.discountedUnitPriceAfterAllDiscountsSet!.shopMoney.amount = "0"; }), "insufficient_item_payment"],
    ["insufficient paid item price", withChanges((o) => { o.lineItems!.edges[0]!.node.discountedUnitPriceAfterAllDiscountsSet!.shopMoney.amount = "9.99"; }), "insufficient_item_payment"],
    ["duplicate matching lines", withChanges((o) => { o.lineItems!.edges.push(structuredClone(o.lineItems!.edges[0]!)); }), "wrong_product"],
  ] as const)("rejects %s", (_label, data, reason) => {
    expect(evaluatePaidNoticeOrder(data, "snapshot", customerId)).toEqual({ granted: false, reason });
  });

  it("denies unbound or different customers even for a real paid order", () => {
    expect(evaluatePaidNoticeOrder(order, "snapshot", null)).toEqual({ granted: false, reason: "customer_not_bound" });
    expect(evaluatePaidNoticeOrder(order, "snapshot", "gid://shopify/Customer/999"))
      .toEqual({ granted: false, reason: "customer_not_bound" });
  });

  it("rejects unsupported currencies, malformed prices, fractions, and overflow", () => {
    expect(usdCents("29.00")).toBe(2900);
    expect(usdCents("0")).toBe(0);
    expect(usdCents("1.2")).toBe(120);
    for (const amount of ["-1", "0.001", "1e6", "NaN", " 29.00 ", "999999999999999999999"]) {
      expect(usdCents(amount)).toBeNull();
    }
  });
});

describe("Shopify Admin credential compatibility", () => {
  it("uses the same server-only token for purchase proof and merchant access", async () => {
    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "");
    vi.stubEnv("SHOPIFY_ACCESS_TOKEN", "legacy-token");

    let expectedToken = "legacy-token";
    let reads = 0;
    const request: typeof fetch = async (_url, init) => {
      reads++;
      expect(new Headers(init?.headers).get("X-Shopify-Access-Token")).toBe(expectedToken);
      return new Response(JSON.stringify({ data: { order } }), { status: 200 });
    };

    expect(shopifyAdminAccessToken()).toBe(expectedToken);
    expect(await verifyFreshTruthWeaverPurchase(orderId, "snapshot", customerId, { request }))
      .toMatchObject({ granted: true });

    expectedToken = "canonical-token";
    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", expectedToken);
    expect(shopifyAdminAccessToken()).toBe(expectedToken);
    expect(await verifyFreshTruthWeaverPurchase(orderId, "snapshot", customerId, { request }))
      .toMatchObject({ granted: true });

    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "");
    vi.stubEnv("SHOPIFY_ACCESS_TOKEN", "");
    expect(shopifyAdminAccessToken()).toBeUndefined();
    expect(await verifyFreshTruthWeaverPurchase(orderId, "snapshot", customerId, { request }))
      .toEqual({ granted: false, reason: "missing_proof" });
    expect(reads).toBe(2);
  });
});

describe("server-only Shopify Admin reader", () => {
  it("sends a scoped authenticated read to the right store and rejects missing proof", async () => {
    let calls = 0;
    const request: typeof fetch = async (url, init) => {
      calls++;
      expect(String(url)).toBe("https://fcr-truth-weaver-esimv-203acj81.myshopify.com/admin/api/2026-10/graphql.json");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("X-Shopify-Access-Token")).toBe("test-token");
      const body = JSON.parse(String(init?.body)) as { variables: { id: string } };
      expect(body.variables.id).toBe(orderId);
      return new Response(JSON.stringify({ data: { order } }), { status: 200 });
    };
    expect(await verifyFreshTruthWeaverPurchase(orderId, "snapshot", customerId, {
      adminToken: "test-token", request,
    })).toMatchObject({ granted: true });
    expect(calls).toBe(1);

    expect(await verifyFreshTruthWeaverPurchase("invalid", "snapshot", customerId, {
      adminToken: "test-token", request,
    })).toEqual({ granted: false, reason: "missing_proof" });
    expect(await verifyFreshTruthWeaverPurchase(orderId, "snapshot", null, {
      adminToken: "test-token", request,
    })).toEqual({ granted: false, reason: "customer_not_bound" });
    expect(calls).toBe(1);
  });

  it.each([
    { status: 403, body: { data: { order } } },
    { status: 429, body: { data: { order } } },
    { status: 200, body: { errors: [{ message: "Missing scope" }] } },
    { status: 200, body: { data: { order: null } } },
    { status: 200, body: { data: { order: { ...order, id: "gid://shopify/Order/11111" } } } },
  ])("fails closed on Shopify error, missing order or wrong identity", async ({ status, body }) => {
    const request: typeof fetch = async () => new Response(JSON.stringify(body), { status });
    expect(await verifyFreshTruthWeaverPurchase(orderId, "snapshot", customerId, {
      adminToken: "test-token", request,
    })).toEqual({ granted: false, reason: "missing_proof" });
  });

  it("fails closed when Shopify cannot be reached", async () => {
    const request: typeof fetch = async () => { throw new Error("network down"); };
    expect(await verifyFreshTruthWeaverPurchase(orderId, "snapshot", customerId, {
      adminToken: "test-token", request,
    })).toEqual({ granted: false, reason: "missing_proof" });
  });
});
