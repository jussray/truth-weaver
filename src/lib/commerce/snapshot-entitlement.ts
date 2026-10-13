import type { PaymentProofDecision } from "./shopify-order-proof";

/**
 * $10 Snapshot entitlement seam. Pure and server-only by contract: every
 * input must come from server-owned state, never from the request body,
 * checkout return URL, query string, cookie, or continuity marker.
 *
 * - authUserId: from requireSupabaseAuth context (server-validated session)
 * - binding: server-persisted link between that user and a Shopify customer
 * - proof: result of a FRESH Admin read (verifyFreshTruthWeaverPurchase)
 * - entitlement: server-persisted grant row, including revocation state
 *
 * Production blocker: no binding store, entitlement table or Admin token is
 * provisioned yet, so callers have nothing trusted to pass and access stays denied.
 */
export type CustomerBinding = {
  authUserId: string;
  shopifyCustomerId: string;
  verifiedAt: string;
};

export type SnapshotEntitlement = {
  authUserId: string;
  orderId: string;
  offer: "snapshot";
  grantedAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
};

export type SnapshotDeliveryDecision =
  | { deliver: true; orderId: string; authority: "non-authorizing" }
  | {
      deliver: false;
      reason:
        | "not_authenticated"
        | "customer_not_bound"
        | "payment_not_proven"
        | "no_entitlement"
        | "entitlement_mismatch"
        | "revoked"
        | "expired";
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decideSnapshotDelivery(input: {
  authUserId: string | null;
  binding: CustomerBinding | null;
  proof: PaymentProofDecision | null;
  entitlement: SnapshotEntitlement | null;
  now: Date;
}): SnapshotDeliveryDecision {
  const { authUserId, binding, proof, entitlement, now } = input;
  const deny = (reason: Extract<SnapshotDeliveryDecision, { deliver: false }>["reason"]) =>
    ({ deliver: false, reason }) as const;

  if (!authUserId || !UUID.test(authUserId)) return deny("not_authenticated");
  if (!binding || binding.authUserId !== authUserId) return deny("customer_not_bound");
  if (!proof || proof.granted !== true || proof.offer !== "snapshot") return deny("payment_not_proven");
  if (!entitlement) return deny("no_entitlement");
  if (entitlement.authUserId !== authUserId || entitlement.orderId !== proof.orderId ||
      entitlement.offer !== "snapshot") return deny("entitlement_mismatch");
  if (entitlement.revokedAt !== null) return deny("revoked");
  if (entitlement.expiresAt !== null) {
    const exp = Date.parse(entitlement.expiresAt);
    if (!Number.isFinite(exp) || exp <= now.getTime()) return deny("expired");
  }
  return { deliver: true, orderId: proof.orderId, authority: "non-authorizing" };
}
