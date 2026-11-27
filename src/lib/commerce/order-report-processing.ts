import { parseStoredAnalysis, type StoredCounselAnalysis } from "../counsel-document";
import { buildPaidReport } from "./paid-report";
import { renderPaidReportPdf } from "./paid-report-pdf";
import { CLAIM_NONCE, REPORT_OFFERS, offerLabels, type ReportOfferKey } from "./report-catalog";
import {
  ORDER_GID,
  REPORT_ORDER_GID,
  STRIPE_REPORT_ORDER_GID,
  evaluatePaidReportOrder,
  type ReportProofDecision,
  validateClaimForOrder,
  type ReportOrderForProof,
  type StoredClaim,
} from "./report-order-proof";
import { SNAPSHOT_MAX_BYTES, SNAPSHOT_REPORT_BUCKET, safeSnapshotKey } from "./snapshot-report-access";

/**
 * Orchestrates one paid order -> one private report PDF. Every port is
 * server-owned; tests use in-memory fakes and never create purchases.
 * Order facts always come from a fresh Admin read, never from the caller.
 */
export type OrderReportRow = {
  orderGid: string;
  userId: string;
  claimNonce: string;
  analysisId: string | null;
  orderName: string;
  offers: ReportOfferKey[];
  status: "pending" | "ready" | "failed";
  storageKey: string | null;
  byteSize: number | null;
  revokedAt: string | null;
  createdAt: string;
  readyAt: string | null;
};

export type NewOrderReport = Pick<OrderReportRow, "orderGid" | "userId" | "claimNonce" | "analysisId" | "orderName" | "offers"> & {
  orderCreatedAt: string;
  verifiedAt: string;
};

export interface OrderReportPorts {
  readOrder(orderGid: string): Promise<ReportOrderForProof | null>;
  readJussPayProof?(orderGid: string): Promise<ReportProofDecision | null>;
  claim(nonce: string): Promise<StoredClaim | null>;
  consumeClaim(nonce: string, orderGid: string): Promise<boolean>;
  report(orderGid: string): Promise<OrderReportRow | null>;
  insertReport(row: NewOrderReport): Promise<void>;
  analysis(id: string, userId: string): Promise<StoredCounselAnalysis | null>;
  newKey(userId: string, orderGid: string): string;
  upload(key: string, bytes: Uint8Array): Promise<boolean>;
  remove(key: string): Promise<void>;
  markReady(orderGid: string, key: string, size: number, at: Date): Promise<boolean>;
  markFailed(orderGid: string, reason: string): Promise<void>;
}

export type ProcessResult =
  | { state: "ready"; orderGid: string }
  | { state: "failed"; orderGid: string; reason: "analysis_missing" | "render_failed" | "upload_failed" }
  | { state: "not_verifiable" }
  | { state: "denied"; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rebuilds a saved analysis through the same strict schema the browser document uses. */
export function storedAnalysisFromRow(row: { metadata: unknown; result: unknown; created_at: string }): StoredCounselAnalysis | null {
  const savedAt = new Date(row.created_at);
  if (!Number.isFinite(savedAt.getTime())) return null;
  return parseStoredAnalysis(JSON.stringify({ version: 1, savedAt: savedAt.toISOString(), metadata: row.metadata, result: row.result }));
}

async function resolveReportPaymentProof(orderGid: string, ports: Pick<OrderReportPorts, "readOrder" | "readJussPayProof">): Promise<ReportProofDecision | null> {
  if (STRIPE_REPORT_ORDER_GID.test(orderGid)) return await ports.readJussPayProof?.(orderGid) ?? null;
  if (!ORDER_GID.test(orderGid)) return null;
  const order = await ports.readOrder(orderGid);
  return order ? evaluatePaidReportOrder(order) : null;
}

export async function processPaidOrder(orderGid: string, ports: OrderReportPorts, now: () => Date = () => new Date()): Promise<ProcessResult> {
  if (!REPORT_ORDER_GID.test(orderGid)) return { state: "denied", reason: "missing_proof" };
  const proof = await resolveReportPaymentProof(orderGid, ports);
  if (!proof) return { state: "not_verifiable" };
  if (!proof.granted) return { state: "denied", reason: proof.reason };
  if (proof.orderId !== orderGid) return { state: "denied", reason: "missing_proof" };

  const claim = await ports.claim(proof.claimNonce);
  const checked = validateClaimForOrder(claim, proof);
  if (!checked.ok || !claim) return { state: "denied", reason: checked.ok ? "claim_missing" : checked.reason };

  let row = await ports.report(orderGid);
  if (!row) {
    if (!(await ports.consumeClaim(claim.nonce, orderGid))) return { state: "denied", reason: "claim_used" };
    await ports.insertReport({
      orderGid,
      userId: claim.userId,
      claimNonce: claim.nonce,
      analysisId: claim.analysisId,
      orderName: proof.orderName,
      offers: proof.offers,
      orderCreatedAt: proof.createdAt,
      verifiedAt: now().toISOString(),
    });
    row = await ports.report(orderGid);
  }
  if (!row || row.userId !== claim.userId || row.claimNonce !== claim.nonce || row.analysisId !== claim.analysisId || row.offers.length !== proof.offers.length || !row.offers.every((offer) => proof.offers.includes(offer))) return { state: "denied", reason: "claim_mismatch" };
  if (row.revokedAt !== null) return { state: "denied", reason: "revoked" };
  if (row.status === "ready" && row.storageKey) return { state: "ready", orderGid };

  const stored = row.analysisId ? await ports.analysis(row.analysisId, row.userId) : null;
  if (!stored) {
    await ports.markFailed(orderGid, "analysis_missing");
    return { state: "failed", orderGid, reason: "analysis_missing" };
  }

  let bytes: Uint8Array;
  try {
    const at = now();
    bytes = await renderPaidReportPdf(buildPaidReport({ orderId: orderGid, orderName: row.orderName, offers: row.offers, stored, generatedAt: at }), at);
  } catch {
    await ports.markFailed(orderGid, "render_failed");
    return { state: "failed", orderGid, reason: "render_failed" };
  }

  const key = ports.newKey(row.userId, orderGid);
  if (!safeSnapshotKey(key) || !(await ports.upload(key, bytes))) {
    await ports.markFailed(orderGid, "upload_failed");
    return { state: "failed", orderGid, reason: "upload_failed" };
  }
  if (!(await ports.markReady(orderGid, key, bytes.byteLength, now()))) {
    // Another worker finished first; keep its file and drop this duplicate.
    await ports.remove(key);
    const current = await ports.report(orderGid);
    return current?.status === "ready" ? { state: "ready", orderGid } : { state: "failed", orderGid, reason: "upload_failed" };
  }
  return { state: "ready", orderGid };
}

/* ---------- Owner reads and downloads ---------- */

export interface ReportAccessPorts {
  authenticate(token: string): Promise<string | null>;
  report(orderGid: string): Promise<OrderReportRow | null>;
  readOrder(orderGid: string): Promise<ReportOrderForProof | null>;
  readJussPayProof?(orderGid: string): Promise<ReportProofDecision | null>;
  privateBucket(): Promise<boolean>;
  object(key: string): Promise<{ bucketId: string; contentType: string; size: number } | null>;
  download(key: string): Promise<Blob | null>;
}

export type DownloadResult =
  | { state: "ready"; base64: string; mediaType: "application/pdf"; filename: string }
  | { state: "not_authenticated" | "not_available" | "payment_not_confirmed" };

/** Owned selection + fresh payment proof + private object checks, then bounded in-memory bytes. */
export async function accessOrderReport(token: string, orderGid: string, ports: ReportAccessPorts): Promise<DownloadResult> {
  const denied = { state: "not_available" } as const;
  if (!token || token.length > 8192) return { state: "not_authenticated" };
  try {
    const userId = await ports.authenticate(token);
    if (!userId || !UUID.test(userId)) return { state: "not_authenticated" };
    if (!REPORT_ORDER_GID.test(orderGid)) return denied;
    const row = await ports.report(orderGid);
    if (!row || row.userId !== userId || row.status !== "ready" || row.revokedAt !== null ||
        !row.storageKey || !safeSnapshotKey(row.storageKey)) return denied;

    const proof = await resolveReportPaymentProof(orderGid, ports);
    if (!proof?.granted || proof.orderId !== orderGid || proof.claimNonce !== row.claimNonce ||
        (STRIPE_REPORT_ORDER_GID.test(orderGid) && (!proof.buyer || proof.buyer.userId !== userId || proof.buyer.analysisId !== row.analysisId)) ||
        row.offers.length !== proof.offers.length || !row.offers.every((offer) => proof.offers.includes(offer))) return { state: "payment_not_confirmed" };

    if (!(await ports.privateBucket())) return denied;
    const object = await ports.object(row.storageKey);
    if (!object || object.bucketId !== SNAPSHOT_REPORT_BUCKET || object.contentType !== "application/pdf" ||
        !Number.isSafeInteger(object.size) || object.size <= 0 || object.size > SNAPSHOT_MAX_BYTES) return denied;
    const blob = await ports.download(row.storageKey);
    if (!blob || blob.size <= 0 || blob.size > SNAPSHOT_MAX_BYTES) return denied;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > SNAPSHOT_MAX_BYTES || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return denied;

    // Revocation can land while bytes are read; check ownership state once more.
    const final = await ports.report(orderGid);
    if (!final || final.userId !== userId || final.revokedAt !== null || final.storageKey !== row.storageKey) return denied;

    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { state: "ready", base64: btoa(binary), mediaType: "application/pdf", filename: `truth-weaver-report-${orderGid.split("/").pop()}.pdf` };
  } catch {
    // No tokens, keys or provider bodies reach logs or responses.
    return denied;
  }
}

export type OwnReportSummary = {
  orderGid: string;
  orderName: string;
  items: string[];
  status: OrderReportRow["status"];
  createdAt: string;
  readyAt: string | null;
  hasAnalysis: boolean;
};

export function summarizeReport(row: OrderReportRow): OwnReportSummary {
  return {
    orderGid: row.orderGid,
    orderName: row.orderName,
    items: offerLabels(row.offers),
    status: row.revokedAt !== null ? "failed" : row.status,
    createdAt: row.createdAt,
    readyAt: row.readyAt,
    hasAnalysis: row.analysisId !== null,
  };
}

/* ---------- Claims ---------- */

const CLAIM_DAYS = 7;

/** 32 random bytes as base64url (43 chars). Call only inside a request handler. */
export function newClaimNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const nonce = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (!CLAIM_NONCE.test(nonce)) throw new Error("Claim generation failed.");
  return nonce;
}

export function claimExpiry(from: Date): Date {
  return new Date(from.getTime() + CLAIM_DAYS * 24 * 60 * 60 * 1000);
}

export const REPORT_SKUS = Object.values(REPORT_OFFERS).map((offer) => offer.sku);
