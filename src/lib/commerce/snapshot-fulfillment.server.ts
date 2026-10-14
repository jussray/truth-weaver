import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { analyzeLegalNoticeOnServer } from "../notice-analyzer.server";
import { buildNoticeSnapshotReport } from "../notice-report";
import type { NoticeAnalyzerInput } from "../notice-analyzer";
import { fulfillVerifiedSnapshot } from "./snapshot-fulfillment";
import { verifyFreshTruthWeaverPurchase } from "./shopify-order.server";

const BUCKET = "tw-snapshot-reports";
const CONTENT_TYPE = "text/plain";
const ORDER = /^gid:\/\/shopify\/Order\/([1-9][0-9]*)$/;

/** Only real buyer/entitlement records + fresh paid Shopify proof can create a report.
 * The submitted notice is analyzed afresh server-side and never treated as law.
 */
export async function createOwnedSnapshotReport(token: string, orderId: string, notice: NoticeAnalyzerInput) {
  return fulfillVerifiedSnapshot(token, orderId, notice, {
    now: () => new Date(),
    authenticate: async accessToken => {
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
      return error || !data.user ? null : data.user.id;
    },
    binding: async userId => {
      const { data, error } = await supabaseAdmin.from("tw_shopify_customer_bindings")
        .select("auth_user_id, shopify_customer_gid, verified_at")
        .eq("auth_user_id", userId).maybeSingle();
      return error || !data ? null : {
        authUserId: data.auth_user_id,
        shopifyCustomerId: data.shopify_customer_gid,
        verifiedAt: data.verified_at,
      };
    },
    entitlement: async (userId, id) => {
      const { data, error } = await supabaseAdmin.from("tw_snapshot_entitlements")
        .select("auth_user_id, order_gid, offer, granted_at, revoked_at, expires_at")
        .eq("auth_user_id", userId).eq("order_gid", id).maybeSingle();
      if (error || !data || data.offer !== "snapshot") return null;
      return {
        authUserId: data.auth_user_id, orderId: data.order_gid, offer: "snapshot",
        grantedAt: data.granted_at, revokedAt: data.revoked_at, expiresAt: data.expires_at,
      };
    },
    reportExists: async (userId, id) => {
      const { data, error } = await supabaseAdmin.from("tw_snapshot_report_locations")
        .select("order_gid").eq("auth_user_id", userId).eq("order_gid", id).maybeSingle();
      // Fail closed on lookup errors. Otherwise a corrupted/unknown state can be overwritten.
      if (error) throw error;
      return !!data;
    },
    verifyPayment: (id, customerId) => verifyFreshTruthWeaverPurchase(id, "snapshot", customerId),
    generateFromNotice: async input => {
      const result = await analyzeLegalNoticeOnServer(input);
      return buildNoticeSnapshotReport(result, input).content;
    },
    storePrivateReport: async (userId, id, content) => {
      const match = ORDER.exec(id);
      if (!match) return false;
      const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(BUCKET);
      if (bucketError || !bucket || bucket.public !== false) return false;
      const path = userId + "/" + match[1] + "/" + crypto.randomUUID() + ".txt";
      const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET)
        .upload(path, new Blob([content], { type: CONTENT_TYPE }), {
          contentType: CONTENT_TYPE, cacheControl: "0", upsert: false,
        });
      if (uploadError) return false;
      // Immutable order+owner FK and unique order PK block cross-owner replacement/races.
      const { error: locationError } = await supabaseAdmin
        .from("tw_snapshot_report_locations").insert({
          auth_user_id: userId, order_gid: id,
          private_storage_key: path, media_type: "text/plain;charset=utf-8",
        });
      if (locationError) {
        // Best effort orphan cleanup; inaccessible object remains in a private bucket.
        await supabaseAdmin.storage.from(BUCKET).remove([path]);
        return false;
      }
      return true;
    },
  });
}
