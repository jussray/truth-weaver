import { TRUTH_WEAVER_SHOPIFY_DOMAIN } from "../commerce/shopify-order-proof";

/** One server-owned Admin credential for merchant reads and paid-order verification.
 * The legacy SHOPIFY_ACCESS_TOKEN name remains supported during migration.
 * Never expose this credential to a browser or use it as purchase proof.
 */
export function shopifyAdminAccessToken(): string | undefined {
  return process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"] || process.env["SHOPIFY_ACCESS_TOKEN"] || undefined;
}

/** Server-only Shopify Admin GraphQL. Token is read per-call and never returned. */
export async function adminGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = shopifyAdminAccessToken();
  if (!token) throw new Error("Shopify Admin is not connected.");
  const res = await fetch(`https://${TRUTH_WEAVER_SHOPIFY_DOMAIN}/admin/api/2026-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Shopify Admin request failed (${res.status}).`);
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length || !body.data) throw new Error("Shopify Admin returned an error.");
  return body.data;
}
