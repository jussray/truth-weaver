import { describe, expect, it, vi } from "vitest";
import { accessSnapshotReport, readBoundedSnapshotStream, safeSnapshotKey, SNAPSHOT_REPORT_BUCKET, SNAPSHOT_MAX_BYTES, type SnapshotReportPorts } from "./snapshot-report-access";
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
    // Inert in-memory bytes only; no purchase, file or storage fixture is written.
    download: vi.fn(async () => new Blob(["%PDF-isolated-test"], { type: "application/pdf" })),
  };
}
async function denied(override: Partial<SnapshotReportPorts>, token = "isolated-test-token", id = order) {
  const ports = { ...setup(), ...override };
  const result = await accessSnapshotReport(token, id, ports, now);
  expect(result.state).not.toBe("ready");
  expect(ports.download).not.toHaveBeenCalled();
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
  it("rechecks revocation before the private read", async () => {
    const read = vi.fn().mockResolvedValueOnce(entitlement).mockResolvedValueOnce({ ...entitlement, revokedAt: now.toISOString() });
    await denied({ entitlement: read });
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("fails closed on private download failure", async () => {
    const ports = { ...setup(), download: vi.fn(async () => null) };
    expect(await accessSnapshotReport("isolated-test-token", order, ports, now)).toEqual({ state: "not_available" });
  });
  it("rejects expiry occurring during the payment/storage checks", async () => {
    const ports = { ...setup(), entitlement: vi.fn(async () => ({ ...entitlement, expiresAt: "2026-10-31T20:00:01Z" })) };
    const clock = vi.fn().mockReturnValueOnce(now).mockReturnValueOnce(new Date("2026-10-31T20:00:02Z"));
    expect(await accessSnapshotReport("isolated-test-token", order, ports, clock)).toEqual({ state: "not_available" });
    expect(ports.download).not.toHaveBeenCalled();
  });
  it("fails closed on a download exception", async () => {
    const ports = { ...setup(), download: async () => { throw new Error(key); } };
    expect(await accessSnapshotReport("isolated-test-token", order, ports, now)).toEqual({ state: "not_available" });
  });
  it("transfers bounded private bytes only after all gates without keys or URLs", async () => {
    const ports = setup();
    const result = await accessSnapshotReport("isolated-test-token", order, ports, now);
    expect(result.state).toBe("ready");
    expect(ports.verify).toHaveBeenCalledWith(order, "gid://shopify/Customer/456");
    expect(ports.download).toHaveBeenCalledWith(key);
    expect(Object.keys(result).sort()).toEqual(["base64", "mediaType", "state"]);
    expect(JSON.stringify(result)).not.toContain(key);
    expect(ports.download.mock.invocationCallOrder[0]).toBeGreaterThan(ports.object.mock.invocationCallOrder[0] ?? Infinity);
  });
});

describe("private binary limits", () => {
  it("cancels the real bounded stream reader when bytes exceed 524288", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(524289)); }, cancel });
    expect(await readBoundedSnapshotStream(stream)).toBeNull();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("reads a bounded private stream without writing a file", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("%PDF-test")); controller.close(); } });
    const result = await readBoundedSnapshotStream(stream);
    expect(await result?.text()).toBe("%PDF-test");
  });
  it("rejects an oversized declared object before downloading", async () => {
    await denied({ object: async () => ({ bucketId: SNAPSHOT_REPORT_BUCKET, contentType: "application/pdf", size: 524289 }) });
  });
  it("rejects actual oversized bytes despite safe metadata", async () => {
    const ports = { ...setup(), download: vi.fn(async () => new Blob([new Uint8Array(524289)], { type: "application/pdf" })) };
    expect(await accessSnapshotReport("isolated-test-token", order, ports, now)).toEqual({ state: "not_available" });
  });
  it("accepts the exact 524288-byte boundary", async () => {
    const bytes = new Uint8Array(524288); bytes.set(new TextEncoder().encode("%PDF-"));
    const ports = { ...setup(), download: vi.fn(async () => new Blob([bytes], { type: "application/pdf" })) };
    const result = await accessSnapshotReport("isolated-test-token", order, ports, now);
    expect(SNAPSHOT_MAX_BYTES).toBe(524288);
    expect(result.state).toBe("ready");
    if (result.state === "ready") expect(atob(result.base64).length).toBe(524288);
  });
  it("rejects wrong binary MIME", async () => {
    const ports = { ...setup(), download: async () => new Blob(["%PDF-test"], { type: "text/html" }) };
    expect(await accessSnapshotReport("isolated-test-token", order, ports, now)).toEqual({ state: "not_available" });
  });
  it("rejects non-PDF bytes even with PDF MIME", async () => {
    const ports = { ...setup(), download: async () => new Blob(["<html>"], { type: "application/pdf" }) };
    expect(await accessSnapshotReport("isolated-test-token", order, ports, now)).toEqual({ state: "not_available" });
  });
  it("rejects tokens longer than 8192 before auth", async () => {
    const ports = await denied({}, "x".repeat(8193));
    expect(ports.authenticate).not.toHaveBeenCalled();
  });
});
