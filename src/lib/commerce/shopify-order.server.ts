import { type NoticeOffer } from "../notice-offers";
import { getTruthWeaverShopifyAdminToken } from "./shopify-admin-token.server";
import {
  TRUTH_WEAVER_SHOPIFY_DOMAIN,
  evaluatePaidNoticeOrder,
  type PaymentProofDecision,
  type ShopifyOrderForProof,
} from "./shopify-order-proof";

/**
 * Server-only, fresh Shopify Admin read. No browser endpoint is exposed.
 * Never pass an Admin token to the client or persist order PII in a report.
 *
 * Required production prerequisites:
 * - Scoped Admin credentials for this exact Truth Weaver shop
 * - A server-verified Shopify customer ID bound to a real Truth Weaver user
 * - Secure per-user persistence, revocation, and report-delivery handling
 * Until those are proven, the products stay DRAFT and downloads stay disabled.
 */
const VERIFY_ORDER = [
  "query VerifyTruthWeaverOrder($id: ID!) {",
  "  order(id: $id) {",
  "    id test cancelledAt fullyPaid displayFinancialStatus currencyCode",
  "    customer { id }",
  "    totalRefundedSet { shopMoney { amount currencyCode } }",
  "    totalOutstandingSet { shopMoney { amount currencyCode } }",
  "    lineItems(first: 100) {",
  "      pageInfo { hasNextPage }",
  "      edges { node {",
  "        id sku currentQuantity variant { id }",
  "        discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount currencyCode } }",
  "      } }",
  "    }",
  "  }",
  "}",
].join("\n");

type AdminReadResponse = {
  data?: { order?: ShopifyOrderForProof | null };
  errors?: Array<{ message: string }>;
};

/**
 * The customer ID MUST come from a server-controlled identity binding, NOT
 * a request body, a checkout return URL, an email address, or an order note.
 * The optional dependencies are for isolated unit tests only.
 */
export async function verifyFreshTruthWeaverPurchase(
  orderId: string,
  offer: NoticeOffer,
  trustedShopifyCustomerId: string | null,
  dependencies: {
    adminToken?: string;
    request?: typeof fetch;
    /** Webhook callers pass a value under Shopify's 5s delivery window. Default keeps the snapshot path unchanged. */
    timeoutMs?: number;
  } = {},
): Promise<PaymentProofDecision> {
  const denied: PaymentProofDecision = { granted: false, reason: "missing_proof" };
  if (!/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/.test(orderId)) return denied;
  if (!trustedShopifyCustomerId) return { granted: false, reason: "customer_not_bound" };

  const token = dependencies.adminToken ?? await getTruthWeaverShopifyAdminToken();
  if (!token) return denied;

  try {
    const response = await (dependencies.request ?? fetch)(
      "https://" + TRUTH_WEAVER_SHOPIFY_DOMAIN + "/admin/api/2026-10/graphql.json",
      {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query: VERIFY_ORDER, variables: { id: orderId } }),
        signal: AbortSignal.timeout(dependencies.timeoutMs ?? 8_000),
      },
    );
    if (!response.ok) return denied;
    const body = (await response.json()) as AdminReadResponse;
    if (body.errors?.length || !body.data?.order) return denied;
    if (body.data.order.id !== orderId) return denied;
    return evaluatePaidNoticeOrder(body.data.order, offer, trustedShopifyCustomerId);
  } catch {
    // Network, rate-limit, permission, GraphQL and parsing failures never unlock access.
    return denied;
  }
}
