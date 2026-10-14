import { decideSnapshotDelivery, type CustomerBinding, type SnapshotEntitlement } from "./snapshot-entitlement";
import type { PaymentProofDecision } from "./shopify-order-proof";

/** Trusted server adapters. No user-provided customer IDs, payment state or object paths. */
export type SnapshotDownloadDependencies = {
  authenticate: (accessToken: string) => Promise<string | null>;
  binding: (userId: string) => Promise<CustomerBinding | null>;
  entitlement: (userId: string, orderId: string) => Promise<SnapshotEntitlement | null>;
  reportLocation: (userId: string, orderId: string) => Promise<{ authUserId: string; orderId: string; key: string } | null>;
  verifyPayment: (orderId: string, customerId: string) => Promise<PaymentProofDecision>;
  signPrivateReport: (key: string) => Promise<string | null>;
  now: () => Date;
};

export type SnapshotDownloadResult =
  | { available: true; url: string; expiresInSeconds: 45 }
  | { available: false; reason: "not_available" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER = /^gid:\/\/shopify\/Order\/[1-9][0-9]*$/;
const DENIED: SnapshotDownloadResult = { available: false, reason: "not_available" };

/**
 * Fail closed on every missing or stale authority fact.
 * An order ID is only a lookup key. It is never treated as payment proof.
 */
export async function authorizeSnapshotDownload(
  accessToken: string,
  orderId: string,
  deps: SnapshotDownloadDependencies,
): Promise<SnapshotDownloadResult> {
  if (!accessToken || accessToken.length > 8192 || !ORDER.test(orderId)) return DENIED;
  try {
    const userId = await deps.authenticate(accessToken);
    if (!userId || !UUID.test(userId)) return DENIED;
    const binding = await deps.binding(userId);
    if (!binding || binding.authUserId !== userId || !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(binding.shopifyCustomerId)) return DENIED;
    const entitlement = await deps.entitlement(userId, orderId);
    if (!entitlement || entitlement.authUserId !== userId || entitlement.orderId !== orderId) return DENIED;
    const location = await deps.reportLocation(userId, orderId);
    if (!location || location.authUserId !== userId || location.orderId !== orderId ||
      !/^[a-zA-Z0-9/_-]{12,512}\.(?:txt|pdf)$/.test(location.key) || location.key.startsWith("/")) return DENIED;
    const proof = await deps.verifyPayment(orderId, binding.shopifyCustomerId);
    const decision = decideSnapshotDelivery({ authUserId: userId, binding, entitlement, proof, now: deps.now() });
    if (!decision.deliver || decision.orderId !== orderId) return DENIED;
    const url = await deps.signPrivateReport(location.key);
    if (!url) return DENIED;
    return { available: true, url, expiresInSeconds: 45 };
  } catch {
    return DENIED;
  }
}
