import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decideSnapshotDelivery } from "./snapshot-entitlement";

const uid = "123e4567-e89b-42d3-a456-426614174000";
const other = "123e4567-e89b-42d3-a456-426614174001";
const orderId = "gid://shopify/Order/67890";
const valid = {
  authUserId: uid,
  binding: { authUserId: uid, shopifyCustomerId: "gid://shopify/Customer/12345", verifiedAt: "2026-10-14T13:00:00Z" },
  proof: { granted: true as const, orderId, offer: "snapshot" as const, variantId: "gid://shopify/ProductVariant/68176830562525" },
  entitlement: { authUserId: uid, orderId, offer: "snapshot" as const, grantedAt: "2026-10-14T13:30:00Z", revokedAt: null, expiresAt: null },
  now: new Date("2026-10-14T14:00:00Z"),
};

describe("Snapshot checkout-to-report safety", () => {
  it("allows only a non-authorizing decision for all trusted facts", () => {
    expect(decideSnapshotDelivery(valid)).toEqual({ deliver: true, orderId, authority: "non-authorizing" });
  });
  it("denies anonymous, mismatched, unproven, missing and revoked delivery", () => {
    expect(decideSnapshotDelivery({ ...valid, authUserId: null })).toEqual({ deliver: false, reason: "not_authenticated" });
    expect(decideSnapshotDelivery({ ...valid, authUserId: other })).toEqual({ deliver: false, reason: "customer_not_bound" });
    expect(decideSnapshotDelivery({ ...valid, proof: null })).toEqual({ deliver: false, reason: "payment_not_proven" });
    expect(decideSnapshotDelivery({ ...valid, binding: null })).toEqual({ deliver: false, reason: "customer_not_bound" });
    expect(decideSnapshotDelivery({ ...valid, entitlement: null })).toEqual({ deliver: false, reason: "no_entitlement" });
    expect(decideSnapshotDelivery({ ...valid, entitlement: { ...valid.entitlement, authUserId: other } })).toEqual({ deliver: false, reason: "entitlement_mismatch" });
    expect(decideSnapshotDelivery({ ...valid, entitlement: { ...valid.entitlement, revokedAt: "2026-10-14T13:59:00Z" } })).toEqual({ deliver: false, reason: "revoked" });
    expect(decideSnapshotDelivery({ ...valid, entitlement: { ...valid.entitlement, expiresAt: "2026-10-14T13:59:00Z" } })).toEqual({ deliver: false, reason: "expired" });
  });
  it("stores report locations behind RLS and provides no client write authority", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261014095600_tw_snapshot_persistence.sql"), "utf8");
    for(const table of ["tw_shopify_customer_bindings", "tw_snapshot_entitlements", "tw_snapshot_report_locations"]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated;`);
      expect(sql).toContain(`GRANT ALL ON public.${table} TO service_role;`);
    }
    expect(sql).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE|ALL) ON public.tw_snapshot_entitlements TO authenticated/);
    expect(sql).not.toMatch(/CREATE POLICY \w+ ON public.tw_snapshot_report_locations/);
    expect(sql).toContain("FOR SELECT TO authenticated USING (auth.uid() = auth_user_id)");
    expect(sql).toContain("CONSTRAINT tw_snapshot_order_owner_unique UNIQUE (order_gid, auth_user_id)");
    expect(sql).toContain("CONSTRAINT tw_snapshot_report_owner_fk FOREIGN KEY (order_gid, auth_user_id)");

  });
});
