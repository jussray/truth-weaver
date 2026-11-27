import { describe, expect, it } from "vitest";
import {
  claimNonceFrom,
  evaluatePaidReportOrder,
  validateClaimForOrder,
  type ReportOrderForProof,
  type StoredClaim,
} from "./report-order-proof";
import { REPORT_OFFERS } from "./report-catalog";

const nonce = "a".repeat(43);
const orderGid = "gid://shopify/Order/9001";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const analysisId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const createdAt = "2026-11-08T08:00:00.000Z";
const order: ReportOrderForProof = {
  id: orderGid,
  name: "#1001",
  createdAt,
  test: false,
  cancelledAt: null,
  fullyPaid: true,
  displayFinancialStatus: "PAID",
  currencyCode: "USD",
  customAttributes: [{ key: "_tw_claim", value: nonce }],
  totalRefundedSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } },
  totalOutstandingSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } },
  lineItems: {
    pageInfo: { hasNextPage: false },
    edges: [{
      node: {
        id: "gid://shopify/LineItem/9002",
        sku: REPORT_OFFERS.snapshot.sku,
        currentQuantity: 1,
        variant: { id: REPORT_OFFERS.snapshot.variantGid! },
        discountedUnitPriceAfterAllDiscountsSet: { shopMoney: { amount: "10.00", currencyCode: "USD" } },
      },
    }],
  },
};
const claim: StoredClaim = {
  nonce, userId, analysisId,
  createdAt: "2026-11-08T07:59:00.000Z",
  expiresAt: "2026-11-15T07:59:00.000Z",
  consumedOrderGid: null,
};

function changed(modify: (o: ReportOrderForProof) => void): ReportOrderForProof {
  const copy = structuredClone(order);
  modify(copy);
  return copy;
}

describe("paid per-order report proof", () => {
  it("accepts a verified full-price, non-test, unrefunded report order with unique claim", () => {
    const proof = evaluatePaidReportOrder(order);
    expect(proof).toEqual({
      granted: true, orderId: orderGid, orderName: "#1001",
      createdAt, offers: ["snapshot"], claimNonce: nonce,
    });
    if (proof.granted) expect(validateClaimForOrder(claim, proof)).toEqual({ ok: true });
  });

  it.each([
    ["test order", changed((o) => { o.test = true; }), "test_order"],
    ["unpaid", changed((o) => { o.fullyPaid = false; }), "order_not_paid"],
    ["refunded", changed((o) => { o.totalRefundedSet!.shopMoney.amount = "1.00"; }), "order_cancelled_or_refunded"],
    ["incomplete line pagination", changed((o) => { o.lineItems!.pageInfo.hasNextPage = true; }), "order_lines_incomplete"],
    ["underpaid product", changed((o) => { o.lineItems!.edges[0]!.node.discountedUnitPriceAfterAllDiscountsSet!.shopMoney.amount = "9.99"; }), "insufficient_item_payment"],
    ["unknown variant", changed((o) => { o.lineItems!.edges[0]!.node.variant!.id = "gid://shopify/ProductVariant/111"; }), "wrong_product"],
    ["missing claim", changed((o) => { o.customAttributes = []; }), "no_claim"],
    ["duplicate claim", changed((o) => { o.customAttributes!.push({ key: "_tw_claim", value: nonce }); }), "no_claim"],
    ["multiple paid quantities for one report", changed((o) => { o.lineItems!.edges[0]!.node.currentQuantity = 2; }), "invalid_quantity"],
    ["duplicate report lines", changed((o) => { o.lineItems!.edges.push(structuredClone(o.lineItems!.edges[0]!)); }), "invalid_quantity"],
  ] as const)("rejects %s", (_label, o, reason) => {
    expect(evaluatePaidReportOrder(o)).toEqual({ granted: false, reason });
  });

  it("ignores browser-shaped claims that do not match strict nonce format", () => {
    expect(claimNonceFrom([{ key: "_tw_claim", value: "forged" }])).toBeNull();
    expect(claimNonceFrom([{ key: "_tw_claim", value: nonce }])).toBe(nonce);
  });

  it("rejects an expired claim or one consumed by a different Shopify order", () => {
    const proof = evaluatePaidReportOrder(order);
    if (!proof.granted) throw new Error("Fixture order is not paid");
    expect(validateClaimForOrder({ ...claim, expiresAt: "2026-11-07T00:00:00.000Z" }, proof))
      .toEqual({ ok: false, reason: "claim_expired" });
    expect(validateClaimForOrder({ ...claim, consumedOrderGid: "gid://shopify/Order/3" }, proof))
      .toEqual({ ok: false, reason: "claim_used" });
  });
});

describe("central JussPay report proof", () => {
  const stripeGid = "gid://stripe/CheckoutSession/cs_live_fixture123";
  const paid = { schema: "jusspay/truthweaver-paid-proof@v1", paid: true, sessionId: "cs_live_fixture123", offerKey: "snapshot", userId, analysisId, claimNonce: nonce, amountTotalMinor: 1000, currency: "usd", createdAt };
  it("binds exact central proof to the stored buyer and analysis, never to caller metadata", async () => {
    const { evaluateJussPayReportProof } = await import("./report-order-proof");
    const proof = evaluateJussPayReportProof(paid, stripeGid);
    expect(proof.granted).toBe(true);
    if (!proof.granted) throw new Error("proof denied");
    expect(validateClaimForOrder(claim, proof)).toEqual({ ok: true });
    expect(validateClaimForOrder({ ...claim, userId: analysisId }, proof)).toEqual({ ok: false, reason: "claim_mismatch" });
    expect(validateClaimForOrder({ ...claim, analysisId: userId }, proof)).toEqual({ ok: false, reason: "claim_mismatch" });
    expect(validateClaimForOrder({ ...claim, consumedOrderGid: orderGid }, proof)).toEqual({ ok: false, reason: "claim_used" });
  });
  it("rejects mismatched price, session, invalid identity, and test payment", async () => {
    const { evaluateJussPayReportProof } = await import("./report-order-proof");
    for (const change of [{ amountTotalMinor: 1 }, { sessionId: "cs_live_other" }, { userId: "bad" }, { paid: false }, { sessionId: "cs_test_fixture123" }, { offerKey: "constructor" }]) {
      expect(evaluateJussPayReportProof({ ...paid, ...change }, stripeGid).granted).toBe(false);
    }
  });
});
