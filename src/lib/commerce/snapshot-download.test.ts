import { describe, expect, it, vi } from "vitest";
import { authorizeSnapshotDownload, type SnapshotDownloadDependencies } from "./snapshot-download";

const uid = "123e4567-e89b-42d3-a456-426614174000";
const order = "gid://shopify/Order/67890";
const customer = "gid://shopify/Customer/12345";
const key = uid + "/67890/123e4567-e89b-42d3-a456-426614174abc.txt";
const token = "server-verified-jwt";
function scenario() {
  const deps: SnapshotDownloadDependencies = {
    authenticate: vi.fn(async () => uid),
    binding: vi.fn(async () => ({ authUserId: uid, shopifyCustomerId: customer, verifiedAt: "2026-10-14T13:00:00Z" })),
    entitlement: vi.fn(async () => ({ authUserId: uid, orderId: order, offer: "snapshot" as const, grantedAt: "2026-10-14T13:10:00Z", revokedAt: null, expiresAt: null })),
    reportLocation: vi.fn(async () => ({ authUserId: uid, orderId: order, key })),
    verifyPayment: vi.fn(async () => ({ granted: true as const, orderId: order, offer: "snapshot" as const,
      variantId: "gid://shopify/ProductVariant/68176830562525" })),
    signPrivateReport: vi.fn(async () => "https://example.supabase.co/storage/v1/object/sign/tw-snapshot-reports/test?token=short-lived"),
    now: () => new Date("2026-10-14T14:00:00Z"),
  };
  return deps;
}
const denied = { available: false, reason: "not_available" };

describe("Snapshot download authorization", () => {
  it("signs only after all five provider/storage facts are verified", async () => {
    const d = scenario();
    const result = await authorizeSnapshotDownload(token, order, d);
    expect(result).toMatchObject({ available: true, expiresInSeconds: 45 });
    expect(d.verifyPayment).toHaveBeenCalledWith(order, customer);
    expect(d.signPrivateReport).toHaveBeenCalledWith(key);
  });
  it("rejects invalid access tokens and order ids before any provider read", async () => {
    const d = scenario();
    expect(await authorizeSnapshotDownload("", order, d)).toEqual(denied);
    expect(await authorizeSnapshotDownload(token, "gid://shopify/Order/0", d)).toEqual(denied);
    expect(d.authenticate).not.toHaveBeenCalled();
  });
  it("never signs for another user's order, forged binding, revoked grant or mismatched storage", async () => {
    const d = scenario();
    d.entitlement = vi.fn(async () => ({ authUserId: "123e4567-e89b-42d3-a456-426614174001", orderId: order,
      offer: "snapshot" as const, grantedAt: "2026-10-14T13:10:00Z", revokedAt: null, expiresAt: null }));
    expect(await authorizeSnapshotDownload(token, order, d)).toEqual(denied);
    expect(d.signPrivateReport).not.toHaveBeenCalled();

    const r = scenario();
    r.entitlement = vi.fn(async () => ({ authUserId: uid, orderId: order, offer: "snapshot" as const,
      grantedAt: "2026-10-14T13:10:00Z", revokedAt: "2026-10-14T13:30:00Z", expiresAt: null }));
    expect(await authorizeSnapshotDownload(token, order, r)).toEqual(denied);
    expect(r.signPrivateReport).not.toHaveBeenCalled();

    const s = scenario();
    s.reportLocation = vi.fn(async () => ({ authUserId: uid, orderId: "gid://shopify/Order/1", key }));
    expect(await authorizeSnapshotDownload(token, order, s)).toEqual(denied);
    expect(s.signPrivateReport).not.toHaveBeenCalled();
  });
  it("rejects another customer's or another order's private object path even if the row claims ownership", async () => {
    const otherUser = scenario();
    otherUser.reportLocation = vi.fn(async () => ({
      authUserId: uid, orderId: order, key: "123e4567-e89b-42d3-a456-426614174001/67890/123e4567-e89b-42d3-a456-426614174abc.txt",
    }));
    expect(await authorizeSnapshotDownload(token, order, otherUser)).toEqual(denied);
    expect(otherUser.signPrivateReport).not.toHaveBeenCalled();

    const otherOrder = scenario();
    otherOrder.reportLocation = vi.fn(async () => ({
      authUserId: uid, orderId: order, key: uid + "/67891/123e4567-e89b-42d3-a456-426614174abc.txt",
    }));
    expect(await authorizeSnapshotDownload(token, order, otherOrder)).toEqual(denied);
    expect(otherOrder.signPrivateReport).not.toHaveBeenCalled();

    const unexpectedPath = scenario();
    unexpectedPath.reportLocation = vi.fn(async () => ({
      authUserId: uid, orderId: order, key: uid + "/67890/../other-user.pdf",
    }));
    expect(await authorizeSnapshotDownload(token, order, unexpectedPath)).toEqual(denied);
    expect(unexpectedPath.signPrivateReport).not.toHaveBeenCalled();
  });
  it("accepts a PDF only when it remains scoped to the same customer and order", async () => {
    const d = scenario();
    const pdf = uid + "/67890/123e4567-e89b-42d3-a456-426614174abd.pdf";
    d.reportLocation = vi.fn(async () => ({ authUserId: uid, orderId: order, key: pdf }));
    expect(await authorizeSnapshotDownload(token, order, d)).toMatchObject({ available: true });
    expect(d.signPrivateReport).toHaveBeenCalledWith(pdf);
  });
  it("does not sign if fresh Shopify proof is unavailable or refunded", async () => {
    const d = scenario();
    d.verifyPayment = vi.fn(async () => ({ granted: false as const, reason: "order_cancelled_or_refunded" as const }));
    expect(await authorizeSnapshotDownload(token, order, d)).toEqual(denied);
    expect(d.signPrivateReport).not.toHaveBeenCalled();
  });
  it("hides missing storage and provider errors without disclosing order existence", async () => {
    const d = scenario();
    d.signPrivateReport = vi.fn(async () => null);
    expect(await authorizeSnapshotDownload(token, order, d)).toEqual(denied);
    const e = scenario();
    e.verifyPayment = vi.fn(async () => { throw new Error("Shopify credentials"); });
    expect(await authorizeSnapshotDownload(token, order, e)).toEqual(denied);
    expect(e.signPrivateReport).not.toHaveBeenCalled();
  });
});
