import { decideSnapshotDelivery, type CustomerBinding, type SnapshotEntitlement } from "./snapshot-entitlement";
import { NOTICE_VARIANTS, type PaymentProofDecision } from "./shopify-order-proof";

export const SNAPSHOT_REPORT_BUCKET = "tw-snapshot-reports";
export const SNAPSHOT_MAX_BYTES = 524288;
export const SNAPSHOT_ORDER_GID = /^gid:\/\/shopify\/Order\/[1-9][0-9]{0,19}$/;

export interface ReportBinding extends CustomerBinding { verificationMethod: string }
export interface ReportEntitlement extends SnapshotEntitlement { variantId: string }
export interface ReportLocation { authUserId: string; orderId: string; key: string; mediaType: string }
export interface SnapshotReportPorts {
  authenticate(token: string): Promise<string | null>;
  binding(userId: string): Promise<ReportBinding | null>;
  entitlement(userId: string, orderId: string): Promise<ReportEntitlement | null>;
  report(userId: string, orderId: string): Promise<ReportLocation | null>;
  verify(orderId: string, customerId: string): Promise<PaymentProofDecision>;
  privateBucket(): Promise<boolean>;
  object(key: string): Promise<{ bucketId: string; contentType: string; size: number } | null>;
  download(key: string): Promise<Blob | null>;
}
export type ReportAccessResult =
  | { state: "ready"; base64: string; mediaType: "application/pdf" }
  | { state: "not_authenticated" | "not_available" };

/** Keys are server-owned opaque paths, never client input. Reject traversal,
 * URLs, encoded separators, control characters and non-PDF objects. */
export function safeSnapshotKey(key: string): boolean {
  return key.length >= 12 && key.length <= 512 &&
    /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.pdf$/.test(key);
}

/** All ports are server-owned. Isolated tests never create purchases or URLs. */
export async function accessSnapshotReport(
  token: string, orderId: string, ports: SnapshotReportPorts, clock: Date | (() => Date) = () => new Date(),
): Promise<ReportAccessResult> {
  const denied = { state: "not_available" } as const;
  const readTime = () => clock instanceof Date ? clock : clock();
  const now = readTime();
  if (!token || token.length > 8192) return { state: "not_authenticated" };
  try {
    const userId = await ports.authenticate(token);
    if (!userId) return { state: "not_authenticated" };
    if (!SNAPSHOT_ORDER_GID.test(orderId)) return denied;
    const binding = await ports.binding(userId);
    if (!binding || binding.authUserId !== userId ||
        binding.verificationMethod !== "verified_customer_account" ||
        !/^gid:\/\/shopify\/Customer\/[1-9][0-9]{0,19}$/.test(binding.shopifyCustomerId) ||
        !Number.isFinite(Date.parse(binding.verifiedAt)) || Date.parse(binding.verifiedAt) > now.getTime()) return denied;
    const entitlement = await ports.entitlement(userId, orderId);
    if (!entitlement || entitlement.orderId !== orderId || entitlement.authUserId !== userId ||
        entitlement.variantId !== NOTICE_VARIANTS.snapshot) return denied;
    const proof = await ports.verify(orderId, binding.shopifyCustomerId);
    const gate = decideSnapshotDelivery({ authUserId: userId, binding, entitlement, proof, now });
    if (!gate.deliver || gate.orderId !== orderId || !proof.granted || proof.variantId !== entitlement.variantId) return denied;
    const report = await ports.report(userId, orderId);
    if (!report || report.authUserId !== userId || report.orderId !== orderId ||
        report.mediaType !== "application/pdf" || !safeSnapshotKey(report.key)) return denied;
    if (!await ports.privateBucket()) return denied;
    const object = await ports.object(report.key);
    if (!object || object.bucketId !== SNAPSHOT_REPORT_BUCKET || object.contentType !== "application/pdf" ||
        !Number.isSafeInteger(object.size) || object.size <= 0 || object.size > SNAPSHOT_MAX_BYTES) return denied;
    // Re-read mutable access immediately before the private read.
    const current = await ports.entitlement(userId, orderId);
    if (!current || current.variantId !== entitlement.variantId ||
        !decideSnapshotDelivery({ authUserId: userId, binding, entitlement: current, proof, now: readTime() }).deliver) return denied;
    const blob = await ports.download(report.key);
    if (!blob || blob.type !== "application/pdf" || blob.size <= 0 || blob.size > SNAPSHOT_MAX_BYTES) return denied;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > SNAPSHOT_MAX_BYTES || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return denied;
    // Recheck access after IO; return bounded in-memory data, never a reusable URL.
    const final = await ports.entitlement(userId, orderId);
    if (!final || final.variantId !== entitlement.variantId ||
        !decideSnapshotDelivery({ authUserId: userId, binding, entitlement: final, proof, now: readTime() }).deliver) return denied;
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { state: "ready", base64: btoa(binary), mediaType: "application/pdf" };
  } catch {
    // No tokens, keys, signed URLs or provider error bodies enter logs/responses.
    return denied;
  }
}