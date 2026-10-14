import { describe, expect, it, vi } from "vitest";
import { fulfillVerifiedSnapshot, type SnapshotFulfillmentDeps } from "./snapshot-fulfillment";
import type { NoticeAnalyzerInput } from "../notice-analyzer";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const id = "gid://shopify/Order/67890";
const customerId = "gid://shopify/Customer/12345";
const sample = { noticeText: "Example notice requires a response by the date printed here. This is test-only content, not a legal deadline.",
  jurisdictionType: "state", jurisdictionDetail: "Pennsylvania", documentTitle: "Example Notice",
  documentType: "", issuer: "", receivedDate: "2026-10-14" } satisfies NoticeAnalyzerInput;
const DENY = { state: "unavailable" };
function deps(): SnapshotFulfillmentDeps {
  return {
    authenticate: vi.fn(async () => userId),
    binding: vi.fn(async () => ({ authUserId: userId, shopifyCustomerId: customerId, verifiedAt: "2026-10-14T12:00:00Z" })),
    entitlement: vi.fn(async () => ({ authUserId: userId, orderId: id, offer: "snapshot", grantedAt: "2026-10-14T12:15:00Z", revokedAt: null, expiresAt: null })),
    reportExists: vi.fn(async () => false),
    verifyPayment: vi.fn(async () => ({ granted: true, orderId: id, offer: "snapshot", variantId: "gid://shopify/ProductVariant/68176830562525" })),
    generateFromNotice: vi.fn(async () => "NON-AUTHORIZING NOTICE SNAPSHOT\n" + "Only source-bound text. ".repeat(12)),
    storePrivateReport: vi.fn(async () => true),
    now: () => new Date("2026-10-14T14:00:00Z"),
  };
}
describe("server-generated Snapshot fulfillment", () => {
  it("generates only with signed-in owner + fresh Shopify proof, rechecking before writing", async () => {
    const d = deps();
    expect(await fulfillVerifiedSnapshot("auth-token", id, sample, d)).toEqual({ state: "created" });
    expect(d.verifyPayment).toHaveBeenCalledTimes(2);
    expect(d.generateFromNotice).toHaveBeenCalledWith(sample);
    expect(d.storePrivateReport).toHaveBeenCalledTimes(1);
  });
  it("never generates if the buyer, order, or paid proof is unverified", async () => {
    const d = deps(); d.binding = vi.fn(async () => null);
    expect(await fulfillVerifiedSnapshot("auth-token", id, sample, d)).toEqual(DENY);
    expect(d.generateFromNotice).not.toHaveBeenCalled();
    const u = deps(); u.verifyPayment = vi.fn(async () => ({ granted: false, reason: "missing_proof" }));
    expect(await fulfillVerifiedSnapshot("auth-token", id, sample, u)).toEqual(DENY);
    expect(u.generateFromNotice).not.toHaveBeenCalled();
  });
  it("does not overwrite an existing customer report", async () => {
    const d = deps(); d.reportExists = vi.fn(async () => true);
    expect(await fulfillVerifiedSnapshot("auth-token", id, sample, d)).toEqual({ state: "already_available" });
    expect(d.generateFromNotice).not.toHaveBeenCalled();
  });
  it("denies post-analysis refunds and revoked entitlements without storing anything", async () => {
    const d = deps();
    let calls = 0;
    d.verifyPayment = vi.fn(async () => ++calls === 1
      ? { granted: true as const, orderId: id, offer: "snapshot" as const, variantId: "gid://shopify/ProductVariant/68176830562525" }
      : { granted: false as const, reason: "order_cancelled_or_refunded" as const });
    expect(await fulfillVerifiedSnapshot("auth-token", id, sample, d)).toEqual(DENY);
    expect(d.storePrivateReport).not.toHaveBeenCalled();
    const v = deps();
    let n = 0;
    v.entitlement = vi.fn(async () => {
      n++;
      return { authUserId: userId, orderId: id, offer: "snapshot" as const, grantedAt: "2026-10-14T12:15:00Z", revokedAt: n === 1 ? null : "2026-10-14T12:20:00Z", expiresAt: null };
    });
    expect(await fulfillVerifiedSnapshot("auth-token", id, sample, v)).toEqual(DENY);
    expect(v.storePrivateReport).not.toHaveBeenCalled();
  });
  it("fails closed on unavailable AI and oversized reports", async () => {
    const d = deps(); d.generateFromNotice = vi.fn(async () => { throw new Error("AI credits unavailable"); });
    expect(await fulfillVerifiedSnapshot("auth-token", id, sample, d)).toEqual(DENY);
    const big = deps(); big.generateFromNotice = vi.fn(async () => "a".repeat(524289));
    expect(await fulfillVerifiedSnapshot("auth-token", id, sample, big)).toEqual(DENY);
    expect(big.storePrivateReport).not.toHaveBeenCalled();
  });
});
