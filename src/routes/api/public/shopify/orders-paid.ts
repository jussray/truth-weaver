import { createFileRoute } from "@tanstack/react-router";
import { gateOrdersPaidWebhook } from "@/lib/commerce/shopify-webhook";

/**
 * Shopify `orders/paid` → Counsel entitlement. Fail-closed:
 * - no SHOPIFY_WEBHOOK_SECRET → 503, nothing recorded
 * - bad signature / wrong shop → 401
 * - no SHOPIFY_ADMIN_ACCESS_TOKEN, unbound customer, or failed fresh paid check → 202, nothing recorded
 * The webhook payload is never trusted as payment proof; a fresh Admin read decides.
 */
export const Route = createFileRoute("/api/public/shopify/orders-paid")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        if (rawBody.length > 1_000_000) return new Response("Too large", { status: 413 });
        const gate = await gateOrdersPaidWebhook({
          rawBody,
          secret: process.env["SHOPIFY_WEBHOOK_SECRET"],
          headers: {
            hmac: request.headers.get("x-shopify-hmac-sha256"),
            shop: request.headers.get("x-shopify-shop-domain"),
            topic: request.headers.get("x-shopify-topic"),
          },
        });
        if (!gate.ok) return Response.json({ recorded: false, reason: gate.reason }, { status: gate.status });
        if (!process.env["SHOPIFY_ADMIN_ACCESS_TOKEN"] || !gate.customerGid)
          return Response.json({ recorded: false, reason: "not_verifiable" }, { status: 202 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { verifyFreshTruthWeaverPurchase } = await import("@/lib/commerce/shopify-order.server");
          const { NOTICE_VARIANTS } = await import("@/lib/commerce/shopify-order-proof");
          const { data: binding, error } = await supabaseAdmin.from("tw_shopify_customer_bindings")
            .select("auth_user_id, shopify_customer_gid").eq("shopify_customer_gid", gate.customerGid).maybeSingle();
          if (error || !binding) return Response.json({ recorded: false, reason: "customer_not_bound" }, { status: 202 });
          const proof = await verifyFreshTruthWeaverPurchase(gate.orderGid, "snapshot", binding.shopify_customer_gid);
          if (!proof.granted) return Response.json({ recorded: false, reason: proof.reason }, { status: 202 });
          const { data: existing } = await supabaseAdmin.from("tw_snapshot_entitlements")
            .select("order_gid").eq("order_gid", proof.orderId).maybeSingle();
          if (existing) return Response.json({ recorded: false, reason: "already_recorded" }, { status: 200 });
          const { error: insertError } = await supabaseAdmin.from("tw_snapshot_entitlements").insert({
            order_gid: proof.orderId, auth_user_id: binding.auth_user_id, variant_gid: NOTICE_VARIANTS.snapshot,
            offer: "snapshot", shopify_verified_at: new Date().toISOString(),
          });
          if (insertError) return Response.json({ recorded: false, reason: "unavailable" }, { status: 500 });
          return Response.json({ recorded: true }, { status: 200 });
        } catch {
          return Response.json({ recorded: false, reason: "unavailable" }, { status: 500 });
        }
      },
    },
  },
});
