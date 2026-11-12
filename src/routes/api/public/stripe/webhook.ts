import { createFileRoute } from "@tanstack/react-router";
import {
  verifyStripeWebhookSignature,
  verifyPaidStripeSession,
} from "@/lib/commerce/jusspay-stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_BODY_BYTES = 500_000;

/**
 * JussPay Stripe checkout webhook endpoint.
 * Route: /api/public/stripe/webhook
 *
 * Security:
 * - Fail closed (HTTP 503) if STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY is absent.
 * - Replay-safe HMAC-SHA256 signature verification (HTTP 401 on invalid).
 * - Live Stripe readback via verifyPaidStripeSession before recording any fulfillment.
 * - Writes verified purchase into tw_order_reports for customer fulfillment.
 */
export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
        const stripeSecretKey = process.env["STRIPE_SECRET_KEY"];

        if (!webhookSecret || !stripeSecretKey) {
          return new Response("Stripe integration unavailable", { status: 503 });
        }

        const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
        if (contentLength > MAX_BODY_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }

        const rawBody = await request.text();
        const signature = request.headers.get("stripe-signature");

        const isValid = await verifyStripeWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { type: string; data?: { object?: { id: string } } };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Malformed JSON", { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const sessionId = event.data?.object?.id;
          if (!sessionId) {
            return Response.json({ received: true, verified: false, reason: "missing_session_id" }, { status: 200 });
          }

          // Live readback from Stripe API
          const session = await verifyPaidStripeSession(sessionId, stripeSecretKey);
          if (!session || !session.paid) {
            return Response.json({ received: true, verified: false, reason: "readback_unverified" }, { status: 202 });
          }

          // Record fulfillment in tw_order_reports
          const orderGid = `gid://stripe/CheckoutSession/${sessionId}`;
          const nowIso = new Date().toISOString();

          try {
            await supabaseAdmin.from("tw_order_reports").upsert({
              order_gid: orderGid,
              order_name: `Stripe ${sessionId.slice(-8).toUpperCase()}`,
              user_id: session.userId,
              analysis_id: session.analysisId || null,
              claim_nonce: session.claimNonce || `stripe_${sessionId.slice(-16)}`,
              offers: [session.offerKey],
              status: "ready",
              order_created_at: nowIso,
              shopify_verified_at: nowIso,
              ready_at: nowIso,
            }, { onConflict: "order_gid" });

            return Response.json({ received: true, verified: true, orderGid }, { status: 200 });
          } catch {
            return Response.json({ received: true, verified: false, reason: "db_error" }, { status: 503 });
          }
        }

        return Response.json({ received: true, ignored: true }, { status: 200 });
      },
    },
  },
});
