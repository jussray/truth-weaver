import type { NoticeAnalyzerInput } from "../notice-analyzer";
import { decideSnapshotDelivery, type CustomerBinding, type SnapshotEntitlement } from "./snapshot-entitlement";
import type { PaymentProofDecision } from "./shopify-order-proof";

/** No client-provided report, Shopify customer ID, or payment fact crosses this boundary. */
export type SnapshotFulfillmentDeps = {
  authenticate(token: string): Promise<string | null>;
  binding(userId: string): Promise<CustomerBinding | null>;
  entitlement(userId: string, orderId: string): Promise<SnapshotEntitlement | null>;
  reportExists(userId: string, orderId: string): Promise<boolean>;
  verifyPayment(orderId: string, customerId: string): Promise<PaymentProofDecision>;
  generateFromNotice(notice: NoticeAnalyzerInput): Promise<string>;
  storePrivateReport(userId: string, orderId: string, content: string): Promise<boolean>;
  now(): Date;
};
export type SnapshotFulfillmentResult =
  | { state: "created" | "already_available" }
  | { state: "unavailable" };
const DENY: SnapshotFulfillmentResult = { state: "unavailable" };
const ORDER = /^gid:\/\/shopify\/Order\/[1-9][0-9]*$/;

/**
 * Server-side authorization must succeed both before expensive analysis and
 * immediately before the immutable report location is stored. No side effects
 * should be attempted until fresh provider identity and payment checks pass.
 */
export async function fulfillVerifiedSnapshot(
  token: string, orderId: string, notice: NoticeAnalyzerInput,
  deps: SnapshotFulfillmentDeps,
): Promise<SnapshotFulfillmentResult> {
  if (!token || token.length > 8192 || !ORDER.test(orderId)) return DENY;
  try {
    const userId = await deps.authenticate(token);
    if (!userId) return DENY;
    const binding = await deps.binding(userId);
    if (!binding) return DENY;
    const valid = async () => {
      const entitlement = await deps.entitlement(userId, orderId);
      const proof = await deps.verifyPayment(orderId, binding.shopifyCustomerId);
      return decideSnapshotDelivery({ authUserId: userId, binding, entitlement, proof, now: deps.now() }).deliver;
    };
    if (!await valid()) return DENY;
    if (await deps.reportExists(userId, orderId)) return { state: "already_available" };
    const content = await deps.generateFromNotice(notice);
    if (typeof content !== "string" || content.trim().length < 80 ||
        new TextEncoder().encode(content).byteLength > 524288) return DENY;
    // A payment can be refunded or a grant revoked during AI processing.
    if (!await valid()) return DENY;
    const saved = await deps.storePrivateReport(userId, orderId, content);
    return saved ? { state: "created" } : DENY;
  } catch {
    // Missing AI credits, identity changes, storage failures, and provider outages deny.
    return DENY;
  }
}
