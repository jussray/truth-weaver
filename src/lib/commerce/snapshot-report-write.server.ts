import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { NoticeAnalyzerInput } from "../notice-analyzer";
import { buildNoticeSnapshotReport } from "../notice-report";
import { prepareOwnedSnapshotReport } from "./snapshot-report-write";
import { verifyFreshTruthWeaverPurchase } from "./shopify-order.server";

const BUCKET = "tw-snapshot-reports";

/**
 * Only server-verified customers with still-valid paid entitlements may
 * generate a report. A report is built from a FRESH server notice analysis.
 */
export async function createVerifiedSnapshotReport(
  authAccessToken: string, orderId: string, notice: NoticeAnalyzerInput,
) {
  return prepareOwnedSnapshotReport(authAccessToken, orderId, notice, {
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
      return { authUserId: data.auth_user_id, orderId: data.order_gid, offer: "snapshot" as const,
        grantedAt: data.granted_at, revokedAt: data.revoked_at, expiresAt: data.expires_at };
    },
    hasReport: async (userId, id) => {
      const { data, error } = await supabaseAdmin.from("tw_snapshot_report_locations")
        .select("order_gid").eq("auth_user_id", userId).eq("order_gid", id).maybeSingle();
      if (error) throw error;
      return !!data;
    },
    reserveReport: async (userId, id) => {
      // Fail closed if the atomic reservation migration has not been deployed.
      const { data, error } = await supabaseAdmin.rpc("tw_reserve_snapshot_generation", {
        p_auth_user_id: userId, p_order_gid: id,
      });
      return !error && data === true;
    },
    releaseReport: async (userId, id) => {
      // No automatic retry after an uncertain AI-provider outcome. An operator
      // must review the reservation and payment before allowing another charge.
      void userId;
      void id;
    },
    storageReady: async () => {
      const { data, error } = await supabaseAdmin.storage.getBucket(BUCKET);
      return !error && data?.public === false;
    },
    verifyPayment: (id, customerId) => verifyFreshTruthWeaverPurchase(id, "snapshot", customerId),
    generateReport: async input => {
      const { analyzeLegalNoticeOnServer } = await import("../notice-analyzer.server");
      const result = await analyzeLegalNoticeOnServer(input);
      return buildNoticeSnapshotReport(result, input).content;
    },
    saveReport: async (userId, id, content) => {
      const orderNumber = id.slice("gid://shopify/Order/".length);
      const key = userId + "/" + orderNumber + "/" + randomUUID() + ".txt";
      const file = new TextEncoder().encode(content);
      if (file.byteLength > 524288) return false;
      const { error: uploadedError } = await supabaseAdmin.storage.from(BUCKET).upload(key, file, {
        contentType: "text/plain", upsert: false, cacheControl: "0",
      });
      if (uploadedError) return false;
      const { error: insertError } = await supabaseAdmin.from("tw_snapshot_report_locations").insert({
        auth_user_id: userId, order_gid: id, private_storage_key: key,
        media_type: "text/plain;charset=utf-8",
      });
      if (!insertError) return true;
      // A lost insert response could still mean the record was committed.
      // Avoid deleting a customer-owned file when database state is uncertain.
      const { data: recorded, error: lookupError } = await supabaseAdmin
        .from("tw_snapshot_report_locations").select("private_storage_key")
        .eq("auth_user_id", userId).eq("order_gid", id).maybeSingle();
      if (lookupError) return false;
      if (recorded?.private_storage_key === key) return true;
      // Only the unreferenced object created by this request may be cleaned up.
      await supabaseAdmin.storage.from(BUCKET).remove([key]);
      return false;
    },
  });
}
