import { TRUTH_WEAVER_SHOPIFY_DOMAIN } from "../commerce/shopify-order-proof";

/** Server-only Shopify Admin GraphQL. Token is read per-call and never returned. */
export async function adminGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"];
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
