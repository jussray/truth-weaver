import { describe, expect, it, vi } from "vitest";
import { prepareOwnedSnapshotReport, type SnapshotReportWriteDependencies } from "./snapshot-report-write";
import type { NoticeAnalyzerInput } from "../notice-analyzer";

const owner = "123e4567-e89b-42d3-a456-426614174000";
const another = "123e4567-e89b-42d3-a456-426614174001";
const order = "gid://shopify/Order/123";
const customer = "gid://shopify/Customer/900";
const token = "session-from-supabase";
const notice: NoticeAnalyzerInput = {
  noticeText: "This is a fictional notice for testing a privately generated educational summary.",
  jurisdictionType: "state", jurisdictionDetail: "Pennsylvania",
  documentTitle: "Fixture notice", documentType: "Notice",
  issuer: "Example issuer", receivedDate: "2026-10-14",
};
const report = "TRUTH WEAVER | NOTICE SNAPSHOT\nEDUCATIONAL RESEARCH AID | NON-AUTHORIZING\nNo law verified.";

function deps(): SnapshotReportWriteDependencies {
  return {
    authenticate: vi.fn(async () => owner),
    binding: vi.fn(async () => ({ authUserId: owner, shopifyCustomerId: customer, verifiedAt: "2026-10-14T13:00:00Z" })),
    entitlement: vi.fn(async () => ({ authUserId: owner, orderId: order, offer: "snapshot" as const, grantedAt: "2026-10-14T13:00:00Z", revokedAt: null, expiresAt: null })),
    hasReport: vi.fn(async () => false),
    reserveReport: vi.fn(async () => true),
    recordFailedAttempt: vi.fn(async () => {}),
    storageReady: vi.fn(async () => true),
    verifyPayment: vi.fn(async () => ({ granted: true as const, orderId: order, offer: "snapshot" as const,
      variantId: "gid://shopify/ProductVariant/68176830562525" })),
    generateReport: vi.fn(async () => report),
    saveReport: vi.fn(async () => true),
    now: () => new Date("2026-10-14T14:00:00Z"),
  };
}
const blocked = { state: "unavailable" };

describe("Paid Snapshot generation and private storage gate", () => {
  it("requires a fresh successful Shopify read before and after generating", async () => {
    const d = deps();
    expect(await prepareOwnedSnapshotReport(token, order, notice, d)).toEqual({ state: "created" });
    expect(d.verifyPayment).toHaveBeenCalledTimes(2);
    expect(d.generateReport).toHaveBeenCalledWith(notice);
    expect(d.saveReport).toHaveBeenCalledWith(owner, order, report);
  });
  it("never generates for an unverified session or malformed order", async () => {
    const d = deps();
    expect(await prepareOwnedSnapshotReport("", order, notice, d)).toEqual(blocked);
    expect(await prepareOwnedSnapshotReport(token, "gid://shopify/Order/0", notice, d)).toEqual(blocked);
    expect(d.authenticate).not.toHaveBeenCalled();
    expect(d.generateReport).not.toHaveBeenCalled();
  });
  it("denies stolen ownership and revoked or expired grants", async () => {
    const a = deps();
    a.binding = vi.fn(async () => ({ authUserId: another, shopifyCustomerId: customer, verifiedAt: "2026-10-14T13:00:00Z" }));
    expect(await prepareOwnedSnapshotReport(token, order, notice, a)).toEqual(blocked);
    expect(a.verifyPayment).not.toHaveBeenCalled();
    const b = deps();
    b.entitlement = vi.fn(async () => ({ authUserId: owner, orderId: order, offer: "snapshot" as const, grantedAt: "2026-10-14T13:00:00Z", revokedAt: "2026-10-14T13:20:00Z", expiresAt: null }));
    expect(await prepareOwnedSnapshotReport(token, order, notice, b)).toEqual(blocked);
    expect(b.generateReport).not.toHaveBeenCalled();
    const c = deps();
    c.entitlement = vi.fn(async () => ({ authUserId: owner, orderId: order, offer: "snapshot" as const, grantedAt: "2026-10-14T13:00:00Z", revokedAt: null, expiresAt: "2026-10-14T13:30:00Z" }));
    expect(await prepareOwnedSnapshotReport(token, order, notice, c)).toEqual(blocked);
    expect(c.generateReport).not.toHaveBeenCalled();
  });
  it("does not use AI without verified payment and a private storage bucket", async () => {
    const a = deps();
    a.verifyPayment = vi.fn(async () => ({ granted: false as const, reason: "test_order" as const }));
    expect(await prepareOwnedSnapshotReport(token, order, notice, a)).toEqual(blocked);
    expect(a.generateReport).not.toHaveBeenCalled();
    const b = deps();
    b.storageReady = vi.fn(async () => false);
    expect(await prepareOwnedSnapshotReport(token, order, notice, b)).toEqual(blocked);
    expect(b.generateReport).not.toHaveBeenCalled();
  });
  it("never charges AI when another request already reserved the order", async () => {
    const d = deps();
    d.reserveReport = vi.fn(async () => false);
    expect(await prepareOwnedSnapshotReport(token, order, notice, d)).toEqual(blocked);
    expect(d.generateReport).not.toHaveBeenCalled();
    expect(d.saveReport).not.toHaveBeenCalled();
  });
  it("holds a durable reservation after AI failure rather than automatically allowing retries", async () => {
    const d = deps();
    d.generateReport = vi.fn(async () => { throw new Error("provider failed after billing"); });
    expect(await prepareOwnedSnapshotReport(token, order, notice, d)).toEqual(blocked);
    expect(d.reserveReport).toHaveBeenCalledTimes(1);
    expect(d.recordFailedAttempt).toHaveBeenCalledTimes(1);
  });
  it("only one concurrent request may invoke paid AI for the same order", async () => {
    const claimed = new Set<string>();
    const d = deps();
    d.reserveReport = vi.fn(async (_userId, orderId) => {
      if (claimed.has(orderId)) return false;
      claimed.add(orderId);
      return true;
    });
    const [first, second] = await Promise.all([
      prepareOwnedSnapshotReport(token, order, notice, d),
      prepareOwnedSnapshotReport(token, order, notice, d),
    ]);
    expect([first.state, second.state].sort()).toEqual(["created", "unavailable"]);
    expect(d.generateReport).toHaveBeenCalledTimes(1);
    expect(d.saveReport).toHaveBeenCalledTimes(1);
    expect(d.reserveReport).toHaveBeenCalledTimes(2);
  });
  it("does not reopen an order after an uncertain provider failure", async () => {
    const claimed = new Set<string>();
    const d = deps();
    d.reserveReport = vi.fn(async (_userId, orderId) => {
      if (claimed.has(orderId)) return false;
      claimed.add(orderId);
      return true;
    });
    d.generateReport = vi.fn(async () => { throw new Error("provider timeout after charge"); });
    expect(await prepareOwnedSnapshotReport(token, order, notice, d)).toEqual(blocked);
    expect(await prepareOwnedSnapshotReport(token, order, notice, d)).toEqual(blocked);
    expect(d.generateReport).toHaveBeenCalledTimes(1);
    expect(d.recordFailedAttempt).toHaveBeenCalledTimes(1);
  });
  it("does not regenerate an existing private report for the same order", async () => {
    const d = deps(); d.hasReport = vi.fn(async () => true);
    expect(await prepareOwnedSnapshotReport(token, order, notice, d)).toEqual({ state: "already_ready" });
    expect(d.generateReport).not.toHaveBeenCalled();
    expect(d.saveReport).not.toHaveBeenCalled();
  });
  it("denies an order refunded during analysis and does not upload", async () => {
    const d = deps();
    d.verifyPayment = vi.fn()
      .mockResolvedValueOnce({ granted: true, orderId: order, offer: "snapshot", variantId: "gid://shopify/ProductVariant/68176830562525" })
      .mockResolvedValueOnce({ granted: false, reason: "order_cancelled_or_refunded" });
    expect(await prepareOwnedSnapshotReport(token, order, notice, d)).toEqual(blocked);
    expect(d.generateReport).toHaveBeenCalledTimes(1);
    expect(d.saveReport).not.toHaveBeenCalled();
  });
  it("never uploads invalid legal content or leaks server exceptions", async () => {
    const a = deps();
    a.generateReport = vi.fn(async () => "A fabricated statement of legal authority.");
    expect(await prepareOwnedSnapshotReport(token, order, notice, a)).toEqual(blocked);
    expect(a.saveReport).not.toHaveBeenCalled();
    const b = deps();
    b.generateReport = vi.fn(async () => { throw new Error("Private notice text: sensitive"); });
    expect(await prepareOwnedSnapshotReport(token, order, notice, b)).toEqual(blocked);
    expect(b.saveReport).not.toHaveBeenCalled();
  });
});
