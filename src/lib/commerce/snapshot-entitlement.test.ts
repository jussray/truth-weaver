import { describe, expect, it } from "vitest";
import { decideSnapshotDelivery, type SnapshotEntitlement } from "./snapshot-entitlement";
import { NOTICE_OFFERS } from "../notice-offers";

const user = "11111111-1111-4111-8111-111111111111";
const order = "gid://shopify/Order/42";
const now = new Date("2026-10-13T00:00:00Z");
const binding = { authUserId: user, shopifyCustomerId: "gid://shopify/Customer/7", verifiedAt: "2026-10-12T00:00:00Z" };
const proof = { granted: true as const, orderId: order, variantId: "v", offer: "snapshot" as const };
const ent: SnapshotEntitlement = { authUserId: user, orderId: order, offer: "snapshot", grantedAt: "2026-10-12T00:00:00Z", revokedAt: null, expiresAt: null };
const base = { authUserId: user, binding, proof, entitlement: ent, now };

describe("decideSnapshotDelivery", () => {
  it("delivers only with every server-owned fact present", () => {
    expect(decideSnapshotDelivery(base)).toEqual({ deliver: true, orderId: order, authority: "non-authorizing" });
  });
  it("fails closed on each missing or mismatched fact", () => {
    expect(decideSnapshotDelivery({ ...base, authUserId: null })).toMatchObject({ reason: "not_authenticated" });
    expect(decideSnapshotDelivery({ ...base, binding: null })).toMatchObject({ reason: "customer_not_bound" });
    expect(decideSnapshotDelivery({ ...base, binding: { ...binding, authUserId: "22222222-2222-4222-8222-222222222222" } })).toMatchObject({ reason: "customer_not_bound" });
    expect(decideSnapshotDelivery({ ...base, proof: { granted: false, reason: "order_not_paid" } })).toMatchObject({ reason: "payment_not_proven" });
    expect(decideSnapshotDelivery({ ...base, proof: { ...proof, offer: "premium" } })).toMatchObject({ reason: "payment_not_proven" });
    expect(decideSnapshotDelivery({ ...base, entitlement: null })).toMatchObject({ reason: "no_entitlement" });
    expect(decideSnapshotDelivery({ ...base, entitlement: { ...ent, orderId: "gid://shopify/Order/43" } })).toMatchObject({ reason: "entitlement_mismatch" });
  });
  it("honours revocation and expiry", () => {
    expect(decideSnapshotDelivery({ ...base, entitlement: { ...ent, revokedAt: "2026-10-12T01:00:00Z" } })).toMatchObject({ reason: "revoked" });
    expect(decideSnapshotDelivery({ ...base, entitlement: { ...ent, expiresAt: "2026-10-12T00:00:00Z" } })).toMatchObject({ reason: "expired" });
    expect(decideSnapshotDelivery({ ...base, entitlement: { ...ent, expiresAt: "garbage" } })).toMatchObject({ reason: "expired" });
  });
  it("keeps every paid offer not ready for sale", () => {
    for (const o of Object.values(NOTICE_OFFERS)) expect(o.readyForSale).toBe(false);
  });
});
