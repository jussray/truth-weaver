import type { NoticeAnalyzerInput } from "../notice-analyzer";
import { decideSnapshotDelivery, type CustomerBinding, type SnapshotEntitlement } from "./snapshot-entitlement";
import type { PaymentProofDecision } from "./shopify-order-proof";

export type SnapshotReportWriteDependencies = {
  authenticate(token: string): Promise<string | null>;
  binding(userId: string): Promise<CustomerBinding | null>;
  entitlement(userId: string, orderId: string): Promise<SnapshotEntitlement | null>;
  hasReport(userId: string, orderId: string): Promise<boolean>;
  /** Atomically claims the order before any paid AI call. Only one caller may win. */
  reserveReport(userId: string, orderId: string): Promise<boolean>;
  /** Releases only this caller\'s reservation on failed generation. */
  releaseReport(userId: string, orderId: string): Promise<void>;
  storageReady(): Promise<boolean>;
  verifyPayment(orderId: string, customerId: string): Promise<PaymentProofDecision>;
  generateReport(notice: NoticeAnalyzerInput): Promise<string | null>;
  saveReport(userId: string, orderId: string, reportContent: string): Promise<boolean>;
  now(): Date;
};

export type SnapshotReportWriteResult =
  | { state: "created" | "already_ready" }
  | { state: "unavailable" };

const DENIED: SnapshotReportWriteResult = { state: "unavailable" };
const VALID_ORDER = /^gid:\/\/shopify\/Order\/[1-9][0-9]*$/;
const VALID_USER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies payment *before* using paid AI and *again* immediately before upload.
 * No checkout redirect, customer ID, authority verdict, report body or storage
 * path from the browser can satisfy a grant. Provider failures fail closed.
 */
export async function prepareOwnedSnapshotReport(
  token: string,
  orderId: string,
  notice: NoticeAnalyzerInput,
  deps: SnapshotReportWriteDependencies,
): Promise<SnapshotReportWriteResult> {
  if (!token || token.length > 8192 || !VALID_ORDER.test(orderId)) return DENIED;
  try {
    const userId = await deps.authenticate(token);
    if (!userId || !VALID_USER.test(userId)) return DENIED;
    const binding = await deps.binding(userId);
    if (!binding || binding.authUserId !== userId ||
      !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(binding.shopifyCustomerId)) return DENIED;
    const entitlement = await deps.entitlement(userId, orderId);
    if (!entitlement || entitlement.authUserId !== userId || entitlement.orderId !== orderId) return DENIED;
    const proof = await deps.verifyPayment(orderId, binding.shopifyCustomerId);
    if (!decideSnapshotDelivery({ authUserId: userId, binding, entitlement, proof, now: deps.now() }).deliver) return DENIED;
    if (!await deps.storageReady()) return DENIED;
    if (await deps.hasReport(userId, orderId)) return { state: "already_ready" };
    if (!await deps.reserveReport(userId, orderId)) return DENIED;

    let saved = false;
    try {
      // All expensive analysis is server-side. The returned report is never sent
      // to the browser by this action. The deterministic report carries disclaimers.
      const report = await deps.generateReport(notice);
      if (!report || !report.startsWith("TRUTH WEAVER | NOTICE SNAPSHOT\n") ||
        !report.includes("NON-AUTHORIZING") ||
        new TextEncoder().encode(report).byteLength > 524288) return DENIED;
  
      // Revocation/expiry may change while AI is generating; re-read the grant.
      const freshEntitlement = await deps.entitlement(userId, orderId);
      const refreshed = await deps.verifyPayment(orderId, binding.shopifyCustomerId);
      if (!decideSnapshotDelivery({ authUserId: userId, binding, entitlement: freshEntitlement, proof: refreshed, now: deps.now() }).deliver) return DENIED;
      if (await deps.saveReport(userId, orderId, report)) { saved = true; return { state: "created" }; }
      return DENIED;
    } finally {
      if (!saved) await deps.releaseReport(userId, orderId);
    }
  } catch {
    // Neither legal notice text nor provider exceptions are disclosed to browser.
    return DENIED;
  }
}
