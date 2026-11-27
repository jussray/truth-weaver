import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TRUTH_WEAVER_SHOPIFY_DOMAIN, NOTICE_VARIANTS } from "./shopify-order-proof";
import { selectPaidSnapshots, type CustomerOrdersPage } from "./snapshot-reconciliation";
import { getTruthWeaverShopifyAdminToken } from "./shopify-admin-token.server";

/** Run only from authenticated server action. No client order IDs or emails.
 * Entitlements are not reports; delivery still requires a fresh paid-order check.
 */
export async function reconcileOwnSnapshotPurchases(authAccessToken: string):
 Promise<{ state: "not_authenticated" | "not_linked" | "unavailable" | "verified"; recorded: number; reportReady: false }> {
  const deny = (state: "not_authenticated" | "not_linked" | "unavailable") =>
    ({ state, recorded: 0, reportReady: false as const });
  if (!authAccessToken || authAccessToken.length > 8192) return deny("not_authenticated");

  try {
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(authAccessToken);
    if (authError || !auth.user) return deny("not_authenticated");

    const { data: binding, error: bindingError } = await supabaseAdmin.from("tw_shopify_customer_bindings")
      .select("shopify_customer_gid").eq("auth_user_id", auth.user.id).maybeSingle();
    if (bindingError) return deny("unavailable");
    if (!binding) return deny("not_linked");

    const adminToken = await getTruthWeaverShopifyAdminToken();
    if (!adminToken) return deny("unavailable");
    const query = [
      "query TruthWeaverOwnedSnapshots($id: ID!) {",
      "  customer(id: $id) { id orders(first: 50, reverse: true) {",
      "    pageInfo { hasNextPage } edges { node {",
      "      id test cancelledAt fullyPaid displayFinancialStatus currencyCode customer { id }",
      "      totalRefundedSet { shopMoney { amount currencyCode } }",
      "      totalOutstandingSet { shopMoney { amount currencyCode } }",
      "      lineItems(first: 100) { pageInfo { hasNextPage } edges { node {",
      "        id sku currentQuantity variant { id }",
      "        discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount currencyCode } }",
      "      } } }",
      "    } } } }",
      "}",
    ].join("\n");
    const response = await fetch("https://" + TRUTH_WEAVER_SHOPIFY_DOMAIN + "/admin/api/2026-10/graphql.json", {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
      body: JSON.stringify({ query, variables: { id: binding.shopify_customer_gid } }),
    });
    if (!response.ok) return deny("unavailable");
    const result = await response.json() as {
      data?: { customer?: CustomerOrdersPage | null }; errors?: Array<{ message: string }>;
    };
    if (result.errors?.length || !result.data) return deny("unavailable");
    const choice = selectPaidSnapshots(result.data.customer ?? null, binding.shopify_customer_gid);
    if (!choice.valid) return deny("unavailable");
    const ids = choice.paidSnapshotOrderIds;
    if (ids.length === 0) return { state: "verified", recorded: 0, reportReady: false };

    const { data: existing, error: readError } = await supabaseAdmin.from("tw_snapshot_entitlements")
      .select("order_gid, auth_user_id, revoked_at").in("order_gid", ids);
    if (readError || !existing) return deny("unavailable");
    if (existing.some(row => row.auth_user_id !== auth.user!.id)) return deny("unavailable");
    const held = new Set(existing.map(row => row.order_gid));
    const toCreate = ids.filter(id => !held.has(id)).map(id => ({
      order_gid: id,
      auth_user_id: auth.user!.id,
      variant_gid: NOTICE_VARIANTS.snapshot,
      offer: "snapshot" as const,
      shopify_verified_at: new Date().toISOString(),
    }));
    // A single INSERT is atomic. Do not overwrite revoked access or other owners.
    if (toCreate.length) {
      const { error: insertError } = await supabaseAdmin.from("tw_snapshot_entitlements").insert(toCreate);
      if (insertError) return deny("unavailable");
    }
    const active = existing.filter(row => row.revoked_at === null).length;
    return { state: "verified", recorded: active + toCreate.length, reportReady: false };
  } catch {
    return deny("unavailable");
  }
}
