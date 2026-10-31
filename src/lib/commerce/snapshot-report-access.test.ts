import { describe, expect, it, vi } from "vitest";
import { accessSnapshotReport, safeSnapshotKey, SNAPSHOT_REPORT_BUCKET, type SnapshotReportPorts } from "./snapshot-report-access";
import { NOTICE_VARIANTS } from "./shopify-order-proof";

const uid = "123e4567-e89b-42d3-a456-426614174000";
const other = "123e4567-e89b-42d3-a456-426614174001";
const order = "gid://shopify/Order/12345";
const key = "opaque-folder/opaque-report.pdf";
const now = new Date("2026-10-31T20:00:00Z");
const entitlement = { authUserId: uid, orderId: order, variantId: NOTICE_VARIANTS.snapshot,
  offer: "snapshot" as const, grantedAt: "2026-10-30T20:00:00Z", revokedAt: null, expiresAt: null };
function setup() {
  return {
    authenticate: vi.fn(async () => uid),
    binding: vi.fn(async () => ({ authUserId: uid, shopifyCustomerId: "gid://shopify/Customer/456",
      verifiedAt: "2026-10-30T20:00:00Z", verificationMethod: "verified_customer_account" })),
    entitlement: vi.fn(async () => entitlement),
    verify: vi.fn(async () => ({ granted: true as const, orderId: order, offer: "snapshot" as const, variantId: NOTICE_VARIANTS.snapshot })),
    report: vi.fn(async () => ({ authUserId: uid, orderId: order, key, mediaType: "application/pdf" })),
    privateBucket: vi.fn(async () => true),
    object: vi.fn(async () => ({ bucketId: SNAPSHOT_REPORT_BUCKET, contentType: "application/pdf", size: 100 })),
    // Inert fixture, no real storage/purchase call and no real signed URL issued.
    sign: vi.fn(async () => "https://storage.example/storage/v1/object/sign/tw-snapshot-reports/opaque.pdf?token=inert-test"),
  };
}
async function denied(override: Partial<SnapshotReportPorts>, token = "isolated-test-token", id = order) {
  const ports = { ...setup(), ...override };
  const result = await accessSnapshotReport(token, id, ports, now);
  expect(result.state).not.toBe("ready");
  expect(ports.sign).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain(key);
  return ports;
}
describe("private Snapshot report retrieval", () => {
  it("validates auth before any binding or payment read", async () => {
    const ports = await denied({ authenticate: async () => null });
    expect(ports.binding).not.toHaveBeenCalled();
    await denied({}, "");
  });
  it("rejects forged order GIDs", async () => {
    for (const id of ["12345", "gid://shopify/Order/0", `${order}?owner=${other}`, `${order}/../456`]) await denied({}, undefined, id);
  });
  it("rejects missing customer binding", async () => { await denied({ binding: async () => null }); });
  it("rejects unverified customer binding", async () => {
    await denied({ binding: async () => ({ authUserId: uid, shopifyCustomerId: "gid://shopify/Customer/456", verifiedAt: now.toISOString(), verificationMethod: "client_claim" }) });
  });
  it.each(["missing_proof", "order_not_paid", "order_cancelled_or_refunded", "test_order"] as const)("rejects fresh proof: %s", async reason => {
    await denied({ verify: async () => ({ granted: false, reason }) });
  });
  it("rejects changed order proof", async () => { await denied({ verify: async () => ({ granted: true, orderId: "gid://shopify/Order/999", offer: "snapshot", variantId: NOTICE_VARIANTS.snapshot }) }); });
  it("rejects missing entitlement", async () => { await denied({ entitlement: async () => null }); });
  it("rejects wrong entitlement owner", async () => { await denied({ entitlement: async () => ({ ...entitlement, authUserId: other }) }); });
  it("rejects revoked entitlement", async () => { await denied({ entitlement: async () => ({ ...entitlement, revokedAt: now.toISOString() }) }); });
  it("rejects expired entitlement", async () => { await denied({ entitlement: async () => ({ ...entitlement, expiresAt: now.toISOString() }) }); });
  it("rejects entitlement variant mismatch", async () => { await denied({ entitlement: async () => ({ ...entitlement, variantId: NOTICE_VARIANTS.premium }) }); });
  it("rejects missing report", async () => { await denied({ report: async () => null }); });
  it("rejects wrong report owner", async () => { await denied({ report: async () => ({ authUserId: other, orderId: order, key, mediaType: "application/pdf" }) }); });
  it("rejects wrong report order", async () => { await denied({ report: async () => ({ authUserId: uid, orderId: "gid://shopify/Order/999", key, mediaType: "application/pdf" }) }); });
  it("rejects unsafe object keys", async () => {
    for (const unsafe of ["../private.pdf", "folder/%2e%2e/private.pdf", "https://elsewhere/file.pdf", "folder\\private.pdf", "folder/with space.pdf"]) {
      expect(safeSnapshotKey(unsafe)).toBe(false);
      await denied({ report: async () => ({ authUserId: uid, orderId: order, key: unsafe, mediaType: "application/pdf" }) });
    }
  });
  it("rejects wrong report MIME", async () => { await denied({ report: async () => ({ authUserId: uid, orderId: order, key, mediaType: "text/html" }) }); });
  it("requires a private bucket", async () => { await denied({ privateBucket: async () => false }); });
  it("rejects missing object", async () => { await denied({ object: async () => null }); });
  it("rejects wrong object MIME", async () => { await denied({ object: async () => ({ bucketId: SNAPSHOT_REPORT_BUCKET, contentType: "text/html", size: 100 }) }); });
  it("rejects objects from another bucket", async () => { await denied({ object: async () => ({ bucketId: "public-reports", contentType: "application/pdf", size: 100 }) }); });
  it("rejects storage errors without leaking the key", async () => { await denied({ object: async () => { throw new Error(key); } }); });
  it("rechecks revocation immediately before signing", async () => {
    const read = vi.fn().mockResolvedValueOnce(entitlement).mockResolvedValueOnce({ ...entitlement, revokedAt: now.toISOString() });
    await denied({ entitlement: read });
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("fails closed on signed URL failure", async () => {
    const ports = { ...setup(), sign: vi.fn(async () => null) };
    expect(await accessSnapshotReport("isolated-test-token", order, ports, now)).toEqual({ state: "not_available" });
  });
  it("rejects expiry occurring during the payment/storage checks", async () => {
    const ports = { ...setup(), entitlement: vi.fn(async () => ({ ...entitlement, expiresAt: "2026-10-31T20:00:01Z" })) };
    const clock = vi.fn().mockReturnValueOnce(now).mockReturnValueOnce(new Date("2026-10-31T20:00:02Z"));
    expect(await accessSnapshotReport("isolated-test-token", order, ports, clock)).toEqual({ state: "not_available" });
    expect(ports.sign).not.toHaveBeenCalled();
  });
  it("fails closed on a signing exception", async () => {
    const ports = { ...setup(), sign: async () => { throw new Error(key); } };
    expect(await accessSnapshotReport("isolated-test-token", order, ports, now)).toEqual({ state: "not_available" });
  });
  it("signs only after all gates, for no more than 60 seconds, without a separate key in the response", async () => {
    const ports = setup();
    const result = await accessSnapshotReport("isolated-test-token", order, ports, now);
    expect(result.state).toBe("ready");
    expect(ports.verify).toHaveBeenCalledWith(order, "gid://shopify/Customer/456");
    expect(ports.sign).toHaveBeenCalledWith(key, 60);
    expect(Object.keys(result).sort()).toEqual(["expiresIn", "state", "url"]);
    expect(JSON.stringify(result)).not.toContain(key);
    expect(ports.sign.mock.invocationCallOrder[0]).toBeGreaterThan(ports.object.mock.invocationCallOrder[0] ?? Infinity);
  });
});