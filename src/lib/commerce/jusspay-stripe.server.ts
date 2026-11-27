/**
 * JussPay Stripe client adapter for Truth Weaver Counsel documents.
 * Canonical JussPay Account: acct_1U4xNyRs4gw4sfJH
 * 
 * Safety contract:
 * - Fail closed if STRIPE_SECRET_KEY is missing.
 * - Replay-safe HMAC-SHA256 signature verification with 300s clock skew tolerance.
 * - Live Stripe readback validation on checkout.session.completed before fulfillment.
 * - Zero secrets exposed to client bundles.
 */

import { REPORT_OFFERS, type ReportOfferKey } from "./report-catalog";

export const JUSSPAY_STRIPE_ACCOUNT = "acct_1U4xNyRs4gw4sfJH";

export type JussPayCheckoutParams = {
  offerKey: ReportOfferKey;
  userId: string;
  analysisId: string;
  claimNonce: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
};

export type JussPayCheckoutSession = {
  sessionId: string;
  url: string;
};

export async function createJussPayCheckoutSession(
  params: JussPayCheckoutParams,
  stripeSecretKey: string | undefined = process.env["STRIPE_SECRET_KEY"],
): Promise<JussPayCheckoutSession> {
  if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
    throw new Error("STRIPE_SECRET_KEY_UNAVAILABLE");
  }

  const offer = REPORT_OFFERS[params.offerKey];
  if (!offer) {
    throw new Error("INVALID_OFFER_KEY");
  }

  const body = new URLSearchParams();
  body.append("payment_method_types[0]", "card");
  body.append("mode", "payment");
  body.append("success_url", params.successUrl);
  body.append("cancel_url", params.cancelUrl);
  if (params.customerEmail) {
    body.append("customer_email", params.customerEmail);
  }

  // Line item
  body.append("line_items[0][price_data][currency]", "usd");
  body.append("line_items[0][price_data][unit_amount]", String(offer.priceUsd * 100));
  body.append("line_items[0][price_data][product_data][name]", offer.label);
  body.append("line_items[0][price_data][product_data][description]", offer.summary);
  body.append("line_items[0][price_data][product_data][metadata][sku]", offer.sku);
  body.append("line_items[0][quantity]", "1");

  // Metadata for fulfillment
  body.append("metadata[offerKey]", offer.key);
  body.append("metadata[sku]", offer.sku);
  body.append("metadata[userId]", params.userId);
  body.append("metadata[analysisId]", params.analysisId);
  body.append("metadata[claimNonce]", params.claimNonce);
  body.append("metadata[stripeAccount]", JUSSPAY_STRIPE_ACCOUNT);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`STRIPE_CHECKOUT_FAILED: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { sessionId: data.id, url: data.url };
}

/**
 * Validates Stripe signature header (t=...,v1=...) against raw payload using Web Crypto.
 * Rejects timestamps older than toleranceSeconds (default 300s).
 */
export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined = process.env["STRIPE_WEBHOOK_SECRET"],
  toleranceSeconds = 300,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!signatureHeader || !secret || !secret.startsWith("whsec_")) {
    return false;
  }

  const parts = signatureHeader.split(",");
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t" && v !== undefined) timestamp = v;
    if (k === "v1" && v !== undefined) signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const tsNum = parseInt(timestamp, 10);
  if (isNaN(tsNum)) return false;

  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - tsNum);
  if (ageSeconds > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const enc = new TextEncoder();

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
    const computedHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    return signatures.some((sig) => {
      if (sig.length !== computedHex.length) return false;
      let mismatch = 0;
      for (let i = 0; i < sig.length; i++) {
        mismatch |= sig.charCodeAt(i) ^ computedHex.charCodeAt(i);
      }
      return mismatch === 0;
    });
  } catch {
    return false;
  }
}

export type VerifiedSessionReadback = {
  paid: boolean;
  offerKey: ReportOfferKey;
  userId: string;
  analysisId: string;
  claimNonce: string;
  customerEmail: string | null;
  amountTotalUsd: number;
};

export async function verifyPaidStripeSession(
  sessionId: string,
  stripeSecretKey: string | undefined = process.env["STRIPE_SECRET_KEY"],
): Promise<VerifiedSessionReadback | null> {
  if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
    return null;
  }

  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    });

    if (!res.ok) return null;

    const session = (await res.json()) as {
      payment_status: string;
      currency: string;
      amount_total: number;
      customer_details?: { email?: string };
      metadata?: Record<string, string>;
    };

    if (session.payment_status !== "paid" || session.currency !== "usd") {
      return null;
    }

    const metadata = session.metadata ?? {};
    const offerKey = metadata["offerKey"] as ReportOfferKey | undefined;
    if (!offerKey) return null;
    const offer = REPORT_OFFERS[offerKey];
    if (!offer) return null;

    if (session.amount_total !== offer.priceUsd * 100) {
      return null;
    }

    return {
      paid: true,
      offerKey,
      userId: metadata["userId"] ?? "",
      analysisId: metadata["analysisId"] ?? "",
      claimNonce: metadata["claimNonce"] ?? "",
      customerEmail: session.customer_details?.email ?? null,
      amountTotalUsd: session.amount_total / 100,
    };
  } catch {
    return null;
  }
}

/** No Stripe key in this proof path; the fixed JussPay origin owns verification. */
export async function readJussPayReportProof(orderGid: string): Promise<import("./report-order-proof").ReportProofDecision | null> {
  const { STRIPE_REPORT_ORDER_GID, evaluateJussPayReportProof } = await import("./report-order-proof");
  const key = process.env["TW_JUSSPAY_SERVICE_KEY"];
  if (process.env["TW_JUSSPAY_REPORTS_ENABLED"] !== "true" || !key || key.length < 32 ||
      !STRIPE_REPORT_ORDER_GID.test(orderGid)) return null;
  try {
    const response = await fetch("https://jusspay.jussco.company/truthweaver/verify-paid", {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", "x-tw-service-key": key },
      body: JSON.stringify({ sessionId: orderGid.split("/").pop() }),
    });
    if (!response.ok) return null;
    const raw = await response.text();
    if (raw.length > 4096) return null;
    return evaluateJussPayReportProof(JSON.parse(raw), orderGid);
  } catch { return null; }
}
