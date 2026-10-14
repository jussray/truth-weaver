import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authorizeSnapshotDownload } from "./snapshot-download";
import { verifyFreshTruthWeaverPurchase } from "./shopify-order.server";

const BUCKET = "tw-snapshot-reports";

/**
 * Server-owned, read-only entitlement fulfillment.
 * Does not create entitlements, accept client storage paths, or authorize a sale.
 */
export async function getVerifiedSnapshotDownload(accessToken: string, orderId: string) {
  return authorizeSnapshotDownload(accessToken, orderId, {
    now: () => new Date(),
    authenticate: async token => {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    binding: async userId => {
      const { data, error } = await supabaseAdmin.from("tw_shopify_customer_bindings")
        .select("auth_user_id, shopify_customer_gid, verified_at")
        .eq("auth_user_id", userId).maybeSingle();
      if (error || !data) return null;
      return { authUserId: data.auth_user_id, shopifyCustomerId: data.shopify_customer_gid, verifiedAt: data.verified_at };
    },
    entitlement: async (userId, id) => {
      const { data, error } = await supabaseAdmin.from("tw_snapshot_entitlements")
        .select("auth_user_id, order_gid, offer, granted_at, revoked_at, expires_at")
        .eq("auth_user_id", userId).eq("order_gid", id).maybeSingle();
      if (error || !data || data.offer !== "snapshot") return null;
      return { authUserId: data.auth_user_id, orderId: data.order_gid, offer: "snapshot", grantedAt: data.granted_at,
        revokedAt: data.revoked_at, expiresAt: data.expires_at };
    },
    reportLocation: async (userId, id) => {
      const { data, error } = await supabaseAdmin.from("tw_snapshot_report_locations")
        .select("auth_user_id, order_gid, private_storage_key")
        .eq("auth_user_id", userId).eq("order_gid", id).maybeSingle();
      return error || !data ? null : { authUserId: data.auth_user_id, orderId: data.order_gid, key: data.private_storage_key };
    },
    verifyPayment: (id, customerId) => verifyFreshTruthWeaverPurchase(id, "snapshot", customerId),
    signPrivateReport: async key => {
      const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(BUCKET);
      if (bucketError || !bucket || bucket.public !== false) return null;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET)
        .createSignedUrl(key, 45, { download: key.endsWith(".pdf") ? "truth-weaver-notice-snapshot.pdf" : "truth-weaver-notice-snapshot.txt" });
      if (error || !data?.signedUrl) return null;
      // Never hand a customer an arbitrary URL, even if an upstream response is malformed.
      const base = process.env["SUPABASE_URL"];
      if (!base) return null;
      const u = new URL(data.signedUrl);
      if (u.protocol !== "https:" || u.origin !== new URL(base).origin ||
        !u.pathname.startsWith("/storage/v1/object/sign/" + BUCKET + "/")) return null;
      return u.toString();
    },
  });
}
