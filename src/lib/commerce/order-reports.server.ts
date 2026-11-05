import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

import type { StoredCounselAnalysis } from "../counsel-document";
import {
  accessOrderReport,
  claimExpiry,
  newClaimNonce,
  processPaidOrder,
  storedAnalysisFromRow,
  summarizeReport,
  type OrderReportPorts,
  type OrderReportRow,
  type OwnReportSummary,
  type ProcessResult,
  type ReportAccessPorts,
} from "./order-report-processing";
import { CLAIM_ATTRIBUTE_KEY, REPORT_OFFER_KEYS, type ReportOfferKey } from "./report-catalog";
import { ORDER_GID, claimNonceFrom, type ReportOrderForProof, type StoredClaim } from "./report-order-proof";
import { getTruthWeaverShopifyAdminToken } from "./shopify-admin-token.server";
import { TRUTH_WEAVER_SHOPIFY_DOMAIN } from "./shopify-order-proof";
import { SNAPSHOT_REPORT_BUCKET, readBoundedSnapshotStream } from "./snapshot-report-access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_URL = `https://${TRUTH_WEAVER_SHOPIFY_DOMAIN}/admin/api/2026-10/graphql.json`;

const ORDER_FIELDS = [
  "id name createdAt test cancelledAt fullyPaid displayFinancialStatus currencyCode",
  "customAttributes { key value }",
  "totalRefundedSet { shopMoney { amount currencyCode } }",
  "totalOutstandingSet { shopMoney { amount currencyCode } }",
  "lineItems(first: 100) { pageInfo { hasNextPage } edges { node {",
  "  id sku currentQuantity variant { id }",
  "  discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount currencyCode } }",
  "} } }",
].join("\n");

/** Payment paths use only the intended custom-app credential; no merchant legacy fallback. */
async function adminRead<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const token = await getTruthWeaverShopifyAdminToken();
  if (!token) return null;
  try {
    const response = await fetch(ADMIN_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: T; errors?: unknown[] };
    return body.errors?.length || !body.data ? null : body.data;
  } catch {
    return null;
  }
}

async function readOrder(orderGid: string): Promise<ReportOrderForProof | null> {
  if (!ORDER_GID.test(orderGid)) return null;
  const data = await adminRead<{ order: ReportOrderForProof | null }>(
    `query TruthWeaverReportOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
    { id: orderGid },
  );
  return data?.order && data.order.id === orderGid ? data.order : null;
}

function toOffers(value: unknown): ReportOfferKey[] {
  return Array.isArray(value) ? value.filter((v): v is ReportOfferKey => REPORT_OFFER_KEYS.includes(v as ReportOfferKey)) : [];
}

async function reportRow(orderGid: string): Promise<OrderReportRow | null> {
  const { data, error } = await supabaseAdmin.from("tw_order_reports")
    .select("order_gid, user_id, claim_nonce, analysis_id, order_name, offers, status, private_storage_key, byte_size, revoked_at, created_at, ready_at")
    .eq("order_gid", orderGid).maybeSingle();
  if (error) throw new Error("Read unavailable");
  if (!data) return null;
  return {
    orderGid: data.order_gid,
    userId: data.user_id,
    claimNonce: data.claim_nonce,
    analysisId: data.analysis_id,
    orderName: data.order_name,
    offers: toOffers(data.offers),
    status: data.status === "ready" || data.status === "failed" ? data.status : "pending",
    storageKey: data.private_storage_key,
    byteSize: data.byte_size,
    revokedAt: data.revoked_at,
    createdAt: data.created_at,
    readyAt: data.ready_at,
  };
}

async function savedAnalysis(id: string, userId: string): Promise<StoredCounselAnalysis | null> {
  if (!UUID.test(id) || !UUID.test(userId)) return null;
  const { data, error } = await supabaseAdmin.from("tw_saved_analyses")
    .select("metadata, result, created_at").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return storedAnalysisFromRow(data);
}

const processingPorts: OrderReportPorts = {
  readOrder,
  async claim(nonce) {
    const { data, error } = await supabaseAdmin.from("tw_purchase_claims")
      .select("nonce, user_id, analysis_id, created_at, expires_at, consumed_order_gid").eq("nonce", nonce).maybeSingle();
    if (error) throw new Error("Read unavailable");
    return data ? {
      nonce: data.nonce, userId: data.user_id, analysisId: data.analysis_id,
      createdAt: data.created_at, expiresAt: data.expires_at, consumedOrderGid: data.consumed_order_gid,
    } satisfies StoredClaim : null;
  },
  async consumeClaim(nonce, orderGid) {
    const { data, error } = await supabaseAdmin.from("tw_purchase_claims")
      .update({ consumed_order_gid: orderGid })
      .eq("nonce", nonce).or(`consumed_order_gid.is.null,consumed_order_gid.eq.${orderGid}`)
      .select("nonce");
    return !error && Array.isArray(data) && data.length === 1;
  },
  report: reportRow,
  async insertReport(row) {
    // Idempotent: a concurrent insert for the same order is re-read by the caller.
    await supabaseAdmin.from("tw_order_reports").upsert({
      order_gid: row.orderGid, user_id: row.userId, claim_nonce: row.claimNonce, analysis_id: row.analysisId,
      order_name: row.orderName, offers: row.offers, status: "pending",
      order_created_at: row.orderCreatedAt, shopify_verified_at: row.verifiedAt,
    }, { onConflict: "order_gid", ignoreDuplicates: true });
  },
  analysis: savedAnalysis,
  newKey(userId, orderGid) {
    const suffix = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    return `orders/${userId}/${orderGid.split("/").pop()}-${suffix}.pdf`;
  },
  async upload(key, bytes) {
    const { error } = await supabaseAdmin.storage.from(SNAPSHOT_REPORT_BUCKET)
      .upload(key, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
    return !error;
  },
  async remove(key) {
    await supabaseAdmin.storage.from(SNAPSHOT_REPORT_BUCKET).remove([key]);
  },
  async markReady(orderGid, key, size, at) {
    const { data, error } = await supabaseAdmin.from("tw_order_reports")
      .update({ status: "ready", private_storage_key: key, byte_size: size, ready_at: at.toISOString(), failure_reason: null })
      .eq("order_gid", orderGid).neq("status", "ready").select("order_gid");
    return !error && Array.isArray(data) && data.length === 1;
  },
  async markFailed(orderGid, reason) {
    await supabaseAdmin.from("tw_order_reports").update({ status: "failed", failure_reason: reason.slice(0, 80) })
      .eq("order_gid", orderGid).neq("status", "ready");
  },
};

async function authenticate(token: string): Promise<string | null> {
  if (!token || token.length > 8192) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const id = error ? null : data.user?.id ?? null;
  return id && UUID.test(id) ? id : null;
}

const accessPorts: ReportAccessPorts = {
  authenticate,
  report: reportRow,
  readOrder,
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

/** Webhook entry: the order GID comes from a signature-verified Shopify message. */
export function processPaidOrderOnServer(orderGid: string): Promise<ProcessResult> {
  return processPaidOrder(orderGid, processingPorts).catch(() => ({ state: "not_verifiable" }) as const);
}

export function downloadOwnOrderReport(token: string, orderGid: string) {
  return accessOrderReport(token, orderGid, accessPorts);
}

export async function listOwnOrderReports(token: string): Promise<{ state: "not_authenticated" | "unavailable" | "ok"; reports: OwnReportSummary[] }> {
  try {
    const userId = await authenticate(token);
    if (!userId) return { state: "not_authenticated", reports: [] };
    const { data, error } = await supabaseAdmin.from("tw_order_reports")
      .select("order_gid").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    if (error || !data) return { state: "unavailable", reports: [] };
    const rows = await Promise.all(data.map((r) => reportRow(r.order_gid)));
    return { state: "ok", reports: rows.filter((r): r is OrderReportRow => r !== null && r.userId === userId).map(summarizeReport) };
  } catch {
    return { state: "unavailable", reports: [] };
  }
}

/** Returns the saved analysis tied to the caller's own order. No payment state is implied. */
export async function ownOrderAnalysis(token: string, orderGid: string): Promise<{ state: "not_authenticated" | "not_available" | "ok"; analysis: StoredCounselAnalysis | null }> {
  try {
    const userId = await authenticate(token);
    if (!userId) return { state: "not_authenticated", analysis: null };
    if (!ORDER_GID.test(orderGid)) return { state: "not_available", analysis: null };
    const row = await reportRow(orderGid);
    if (!row || row.userId !== userId || !row.analysisId) return { state: "not_available", analysis: null };
    const analysis = await savedAnalysis(row.analysisId, userId);
    return analysis ? { state: "ok", analysis } : { state: "not_available", analysis: null };
  } catch {
    return { state: "not_available", analysis: null };
  }
}

/** Server-issued claim that ties one checkout to the caller's account and saved analysis. */
export async function createOwnPurchaseClaim(token: string, analysisId: string): Promise<
  { state: "ok"; attributeKey: string; nonce: string; expiresAt: string } | { state: "not_authenticated" | "not_available" }
> {
  try {
    const userId = await authenticate(token);
    if (!userId) return { state: "not_authenticated" };
    if (!(await savedAnalysis(analysisId, userId))) return { state: "not_available" };
    const created = new Date();
    const nonce = newClaimNonce();
    const expiresAt = claimExpiry(created).toISOString();
    const { error } = await supabaseAdmin.from("tw_purchase_claims").insert({
      nonce, user_id: userId, analysis_id: analysisId, created_at: created.toISOString(), expires_at: expiresAt,
    });
    return error ? { state: "not_available" } : { state: "ok", attributeKey: CLAIM_ATTRIBUTE_KEY, nonce, expiresAt };
  } catch {
    return { state: "not_available" };
  }
}

/**
 * "Check for my purchase": finds Shopify orders carrying the caller's own open
 * claims (fresh Admin search), then runs the same verified processing as the
 * webhook. Also retries the caller's unfinished reports.
 */
export async function reconcileOwnOrders(token: string): Promise<{
  state: "not_authenticated" | "unavailable" | "checked"; ready: number; waiting: number;
}> {
  try {
    const userId = await authenticate(token);
    if (!userId) return { state: "not_authenticated", ready: 0, waiting: 0 };
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: claims, error: claimError }, { data: unfinished, error: rowError }] = await Promise.all([
      supabaseAdmin.from("tw_purchase_claims").select("nonce, created_at").eq("user_id", userId)
        .is("consumed_order_gid", null).gte("created_at", since).order("created_at", { ascending: true }).limit(20),
      supabaseAdmin.from("tw_order_reports").select("order_gid").eq("user_id", userId).neq("status", "ready").is("revoked_at", null).limit(20),
    ]);
    if (claimError || rowError || !claims || !unfinished) return { state: "unavailable", ready: 0, waiting: 0 };

    const orderGids = new Set(unfinished.map((r) => r.order_gid));
    if (claims.length) {
      const earliest = new Date(Date.parse(claims[0]!.created_at) - 60 * 60 * 1000).toISOString();
      const data = await adminRead<{ orders: { nodes: Array<{ id: string; customAttributes: ReportOrderForProof["customAttributes"] }> } }>(
        "query TruthWeaverClaimedOrders($q: String!) { orders(first: 100, sortKey: CREATED_AT, reverse: true, query: $q) { nodes { id customAttributes { key value } } } }",
        { q: `created_at:>='${earliest}'` },
      );
      if (!data) return { state: "unavailable", ready: 0, waiting: 0 };
      const own = new Set(claims.map((c) => c.nonce));
      for (const node of data.orders.nodes) {
        const nonce = claimNonceFrom(node.customAttributes);
        if (nonce && own.has(nonce) && ORDER_GID.test(node.id)) orderGids.add(node.id);
      }
    }
    let ready = 0;
    let waiting = 0;
    for (const gid of [...orderGids].slice(0, 20)) {
      const result = await processPaidOrder(gid, processingPorts);
      if (result.state === "ready") ready++;
      else waiting++;
    }
    return { state: "checked", ready, waiting };
  } catch {
    return { state: "unavailable", ready: 0, waiting: 0 };
  }
}

/** Saves genuine server analyzer output (never the raw notice text) for the verified caller. */
export async function saveAnalysisForUser(token: string, stored: StoredCounselAnalysis): Promise<string | null> {
  try {
    const userId = await authenticate(token);
    if (!userId) return null;
    const { data, error } = await supabaseAdmin.from("tw_saved_analyses")
      .insert({ user_id: userId, metadata: stored.metadata as unknown as Json, result: stored.result as unknown as Json })
      .select("id").single();
    return error || !data ? null : data.id;
  } catch {
    return null;
  }
}

export { authenticate as authenticateReportCaller };
