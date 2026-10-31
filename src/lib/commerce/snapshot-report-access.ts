import { decideSnapshotDelivery, type CustomerBinding, type SnapshotEntitlement } from "./snapshot-entitlement";
import { NOTICE_VARIANTS, type PaymentProofDecision } from "./shopify-order-proof";

export const SNAPSHOT_REPORT_BUCKET = "tw-snapshot-reports";
export const SNAPSHOT_URL_SECONDS = 60;
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
  sign(key: string, seconds: number): Promise<string | null>;
}
export type ReportAccessResult =
  | { state: "ready"; url: string; expiresIn: 60 }
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
        !Number.isFinite(object.size) || object.size <= 0) return denied;
    // Re-read mutable access immediately before signing; never reuse cached proof.
    const current = await ports.entitlement(userId, orderId);
    if (!current || current.variantId !== entitlement.variantId ||
        !decideSnapshotDelivery({ authUserId: userId, binding, entitlement: current, proof, now: readTime() }).deliver) return denied;
    const url = await ports.sign(report.key, SNAPSHOT_URL_SECONDS);
    if (!url) return denied;
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        !parsed.pathname.includes(`/storage/v1/object/sign/${SNAPSHOT_REPORT_BUCKET}/`) ||
        !parsed.searchParams.get("token")) return denied;
    return { state: "ready", url, expiresIn: SNAPSHOT_URL_SECONDS };
  } catch {
    // No tokens, keys, signed URLs or provider error bodies enter logs/responses.
    return denied;
  }
}