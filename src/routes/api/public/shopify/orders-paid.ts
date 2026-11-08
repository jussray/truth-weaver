import { createFileRoute } from "@tanstack/react-router";
import { gateOrdersPaidWebhook, hasReportClaimAttribute, readShopifyWebhookBody } from "@/lib/commerce/shopify-webhook";
import { ungrantedStatus } from "@/lib/commerce/shopify-webhook-status";

/** Keeps the Admin read inside Shopify's 5s delivery window, leaving room for the binding lookup and insert. */
const WEBHOOK_ADMIN_TIMEOUT_MS = 3_000;
const MAX_BODY_BYTES = 1_000_000;

/**
 * Shopify `orders/paid` → Counsel entitlement. Fail-closed:
 * - no SHOPIFY_WEBHOOK_SECRET → 503, nothing recorded
 * - bad signature / wrong shop → 401
 * - unresolved (no Admin token, guest checkout, unbound customer, Admin or DB failure) → 503 so Shopify retries
 * - deliberate permanent non-grant (test order, other product, currency, refunded) → 202, nothing recorded
 * Shopify treats any 2xx as delivered and never retries it, so 202 is never used for unresolved cases.
 * The webhook payload is never trusted as payment proof; a fresh Admin read decides.
 */
export const Route = createFileRoute("/api/public/shopify/orders-paid")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readShopifyWebhookBody(request, MAX_BODY_BYTES);
        if (!body.ok) return new Response(body.status === 413 ? "Too large" : "Malformed body", { status: body.status });
        const { rawBody } = body;
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

        // A Shopify cart claim is only a routing hint. The new report path independently
        // re-reads the paid order through Admin before granting anything.
        const hasReportClaim = hasReportClaimAttribute(rawBody);
        if (hasReportClaim) {
          try {
            const { processPaidOrderOnServer } = await import("@/lib/commerce/order-reports.server");
            const outcome = await processPaidOrderOnServer(gate.orderGid);
            if (outcome.state === "ready")
              return Response.json({ recorded: true, kind: "per_order_report" }, { status: 200 });
            // A failed or unverifiable report must never acknowledge a paid deliverable as complete.
            return Response.json({ recorded: false, kind: "per_order_report", reason: outcome.state }, { status: 503 });
          } catch {
            return Response.json({ recorded: false, kind: "per_order_report", reason: "unavailable" }, { status: 503 });
          }
        }
        if (!gate.customerGid)
          return Response.json({ recorded: false, reason: "not_verifiable" }, { status: 503 });

        try {
          const { getTruthWeaverShopifyAdminToken } = await import("@/lib/commerce/shopify-admin-token.server");
          const adminToken = await getTruthWeaverShopifyAdminToken();
          if (!adminToken) return Response.json({ recorded: false, reason: "not_verifiable" }, { status: 503 });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { verifyFreshTruthWeaverPurchase } = await import("@/lib/commerce/shopify-order.server");
          const { NOTICE_VARIANTS } = await import("@/lib/commerce/shopify-order-proof");
          const { data: binding, error } = await supabaseAdmin.from("tw_shopify_customer_bindings")
            .select("auth_user_id, shopify_customer_gid").eq("shopify_customer_gid", gate.customerGid).maybeSingle();
          if (error) return Response.json({ recorded: false, reason: "unavailable" }, { status: 503 });
          if (!binding) return Response.json({ recorded: false, reason: "customer_not_bound" }, { status: 503 });
          const proof = await verifyFreshTruthWeaverPurchase(gate.orderGid, "snapshot", binding.shopify_customer_gid, { adminToken, timeoutMs: WEBHOOK_ADMIN_TIMEOUT_MS });
          if (!proof.granted)
            return Response.json({ recorded: false, reason: proof.reason }, { status: ungrantedStatus(proof.reason) });
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
