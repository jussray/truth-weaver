import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhookSignature } from "@/lib/commerce/jusspay-stripe.server";
import { processPaidOrderOnServer } from "@/lib/commerce/order-reports.server";
import { STRIPE_REPORT_ORDER_GID } from "@/lib/commerce/report-order-proof";

const MAX_BODY_BYTES = 500_000;
async function boundedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const all = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder("utf-8", { fatal: true }).decode(all);
  } catch { return null; } finally { reader.releaseLock(); }
}

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["STRIPE_WEBHOOK_SECRET"];
    if (!secret) return new Response("Stripe integration unavailable", { status: 503 });
    const raw = await boundedBody(request);
    if (raw === null) return new Response("Invalid or oversized body", { status: 413 });
    if (!await verifyStripeWebhookSignature(raw, request.headers.get("stripe-signature"), secret))
      return new Response("Invalid signature", { status: 401 });
    let event: { type?: string; livemode?: boolean; data?: { object?: { id?: string; metadata?: Record<string,string> } } };
    try { event = JSON.parse(raw); if (!event || typeof event !== "object") throw new Error(); }
    catch { return new Response("Malformed JSON", { status: 400 }); }
    if (event.livemode !== true || !["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type ?? ""))
      return Response.json({ received: true, ignored: true });
    const session = event.data?.object;
    if (!session?.metadata?.offerKey || !session.metadata.claimNonce)
      return Response.json({ received: true, ignored: true });
    const gid = "gid://stripe/CheckoutSession/" + (session.id ?? "");
    if (!STRIPE_REPORT_ORDER_GID.test(gid)) return new Response("Invalid session", { status: 400 });
    // Do not acknowledge fulfillment before central proof, matching stored claim,
    // PDF generation, private upload and persistence of the ready record succeed.
    const result = await processPaidOrderOnServer(gid);
    if (result.state !== "ready") return Response.json({ received: false, state: result.state }, { status: 503 });
    return Response.json({ received: true, verified: true, orderGid: gid });
  } } }
});
