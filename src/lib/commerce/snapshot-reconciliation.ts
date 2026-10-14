import { evaluatePaidNoticeOrder, type ShopifyOrderForProof } from "./shopify-order-proof";

export type CustomerOrdersPage = {
  id: string;
  orders: {
    pageInfo: { hasNextPage: boolean };
    edges: Array<{ node: ShopifyOrderForProof }>;
  } | null;
};
export type ReconciliationDecision =
  | { valid: false; reason: "unverified_customer" | "incomplete_orders" }
  | { valid: true; paidSnapshotOrderIds: string[] };

/** Only fully returned, independently verified Shopify orders can create grants. */
export function selectPaidSnapshots(customer: CustomerOrdersPage | null, trustedCustomerId: string): ReconciliationDecision {
  if (!/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(trustedCustomerId) ||
      customer?.id !== trustedCustomerId) return { valid: false, reason: "unverified_customer" };
  if (!customer.orders || customer.orders.pageInfo.hasNextPage !== false ||
      !Array.isArray(customer.orders.edges) || customer.orders.edges.length > 50)
    return { valid: false, reason: "incomplete_orders" };
  const orderIds = new Set<string>();
  for (const { node } of customer.orders.edges) {
    const proof = evaluatePaidNoticeOrder(node, "snapshot", trustedCustomerId);
    if (proof.granted) orderIds.add(proof.orderId);
  }
  return { valid: true, paidSnapshotOrderIds: [...orderIds] };
}
