import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyFreshTruthWeaverPurchase } from "./shopify-order.server";
import { accessSnapshotReport, readBoundedSnapshotStream, selectOwnedSnapshotOrderId, SNAPSHOT_REPORT_BUCKET, type SnapshotReportPorts } from "./snapshot-report-access";

const ports: SnapshotReportPorts = {
  async authenticate(token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async binding(userId) {
    const { data, error } = await supabaseAdmin.from("tw_shopify_customer_bindings")
      .select("auth_user_id, shopify_customer_gid, verification_method, verified_at")
      .eq("auth_user_id", userId).maybeSingle();
    if (error) throw new Error("Read unavailable");
    return data ? { authUserId: data.auth_user_id, shopifyCustomerId: data.shopify_customer_gid,
      verifiedAt: data.verified_at, verificationMethod: data.verification_method } : null;
  },
  async entitlement(userId, orderId) {
    const { data, error } = await supabaseAdmin.from("tw_snapshot_entitlements")
      .select("auth_user_id, order_gid, variant_gid, offer, granted_at, revoked_at, expires_at")
      .eq("auth_user_id", userId).eq("order_gid", orderId).maybeSingle();
    if (error) throw new Error("Read unavailable");
    return data && data.offer === "snapshot" ? { authUserId: data.auth_user_id, orderId: data.order_gid,
      variantId: data.variant_gid, offer: "snapshot", grantedAt: data.granted_at,
      revokedAt: data.revoked_at, expiresAt: data.expires_at } : null;
  },
  async report(userId, orderId) {
    const { data, error } = await supabaseAdmin.from("tw_snapshot_report_locations")
      .select("auth_user_id, order_gid, private_storage_key, media_type")
      .eq("auth_user_id", userId).eq("order_gid", orderId).maybeSingle();
    if (error) throw new Error("Read unavailable");
    return data ? { authUserId: data.auth_user_id, orderId: data.order_gid,
      key: data.private_storage_key, mediaType: data.media_type } : null;
  },
  verify: (orderId, customerId) => verifyFreshTruthWeaverPurchase(orderId, "snapshot", customerId),
  async privateBucket() {
    const { data, error } = await supabaseAdmin.storage.getBucket(SNAPSHOT_REPORT_BUCKET);
    return !error && data?.id === SNAPSHOT_REPORT_BUCKET && data.public === false;
  },
  async object(key) {
    const { data, error } = await supabaseAdmin.storage.from(SNAPSHOT_REPORT_BUCKET).info(key);
    return error || !data ? null : { bucketId: data.bucketId, contentType: data.contentType ?? "", size: data.size ?? 0 };
  },
  async download(key) {
    const { data, error } = await supabaseAdmin.storage.from(SNAPSHOT_REPORT_BUCKET)
      .download(key, {}, { cache: "no-store", signal: AbortSignal.timeout(8000) }).asStream();
    return error || !data ? null : readBoundedSnapshotStream(data);
  },
};

export async function retrieveOwnSnapshotReport(token: string, requestedOrderId: string) {
  // A caller can choose an order identifier, but not customer identity or storage paths.
  // Every selection is checked against fresh server-owned entitlements and payment proof.
  const own = await listOwnSnapshotReports(token);
  if (own.state === "not_authenticated") return { state: "not_authenticated" } as const;
  if (own.state !== "ok") return { state: "not_available" } as const;
  const selected = selectOwnedSnapshotOrderId(own.orders, requestedOrderId);
  if (!selected) return { state: "not_available" } as const;
  return accessSnapshotReport(token, selected, ports);
}

/** Server-owned enumeration exposes no customer identity, PII, or object keys.
 * A recorded entitlement is not a fresh payment/delivery assertion. */
export async function listOwnSnapshotReports(token: string): Promise<{
  state: "not_authenticated" | "not_linked" | "unavailable" | "ok";
  orders: Array<{ orderId: string }>;
}> {
  if (!token || token.length > 8192) return { state: "not_authenticated", orders: [] };
  try {
    const userId = await ports.authenticate(token);
    if (!userId) return { state: "not_authenticated", orders: [] };
    const binding = await ports.binding(userId);
    if (!binding || binding.verificationMethod !== "verified_customer_account") return { state: "not_linked", orders: [] };
    const { data, error } = await supabaseAdmin.from("tw_snapshot_entitlements")
      .select("order_gid").eq("auth_user_id", userId).eq("offer", "snapshot").eq("variant_gid", "gid://shopify/ProductVariant/68176830562525")
      .is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("granted_at", { ascending: false }).limit(50);
    if (error || !data) return { state: "unavailable", orders: [] };
    return { state: "ok", orders: data.map(row => ({ orderId: row.order_gid })) };
  } catch { return { state: "unavailable", orders: [] }; }
}