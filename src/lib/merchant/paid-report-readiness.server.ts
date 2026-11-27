/**
 * Server-only readiness evaluator for Truth Weaver paid reports.
 * Checks Shopify credentials, JussPay Stripe bindings, and Supabase migrations
 * without ever serializing or exposing secret values.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { REPORT_OFFERS } from "@/lib/commerce/report-catalog";
import { SNAPSHOT_REPORT_BUCKET } from "@/lib/commerce/snapshot-report-access";
import { JUSSPAY_STRIPE_ACCOUNT } from "@/lib/commerce/jusspay-stripe.server";

export type ReadinessItem = {
  name: string;
  status: "configured" | "missing" | "unverified";
  detail: string;
};

export type PaidReportReadiness = {
  evaluatedAt: string;
  isReady: boolean;
  launchHoldReason: string | null;
  shopify: {
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
    webhookSecretConfigured: boolean;
    adminDomainConfigured: boolean;
    status: "configured" | "incomplete" | "missing";
  };
  stripe: {
    account: string;
    secretKeyConfigured: boolean;
    webhookSecretConfigured: boolean;
    status: "configured" | "incomplete" | "missing";
  };
  supabase: {
    savedAnalysesTable: boolean;
    purchaseClaimsTable: boolean;
    orderReportsTable: boolean;
    privateReportBucket: boolean;
    status: "configured" | "incomplete" | "missing";
  };
  catalog: {
    totalOffers: number;
    offers: Array<{
      key: string;
      sku: string;
      label: string;
      priceUsd: number;
      variantPinned: boolean;
      deliverableReady: boolean;
    }>;
  };
};

/** A permission, network or API error is not evidence that a table exists. */
export function readinessTableProbeSucceeded(error: { code?: string } | null): boolean {
  return error === null;
}

/** Match the same private bucket that actually serves paid PDFs. */
export function hasPrivateReportStorage(
  buckets: readonly { name: string; public: boolean }[] | null | undefined,
): boolean {
  return Boolean(buckets?.some((b) => b.name === SNAPSHOT_REPORT_BUCKET && b.public === false));
}

export async function getPaidReportReadiness(): Promise<PaidReportReadiness> {
  const shopifyClientId = Boolean(process.env["SHOPIFY_CLIENT_ID"]?.trim());
  const shopifyClientSecret = Boolean(process.env["SHOPIFY_CLIENT_SECRET"]?.trim());
  const shopifyWebhookSecret = Boolean(process.env["SHOPIFY_WEBHOOK_SECRET"]?.trim());
  const shopifyDomain = Boolean(process.env["SHOPIFY_STORE_DOMAIN"]?.trim());

  const shopifyStatus =
    shopifyClientId && shopifyClientSecret && shopifyWebhookSecret && shopifyDomain
      ? "configured"
      : shopifyClientId || shopifyClientSecret || shopifyWebhookSecret || shopifyDomain
        ? "incomplete"
        : "missing";

  const stripeSecretKey = Boolean(process.env["STRIPE_SECRET_KEY"]?.startsWith("sk_"));
  const stripeWebhookSecret = Boolean(process.env["STRIPE_WEBHOOK_SECRET"]?.startsWith("whsec_"));

  const stripeStatus =
    stripeSecretKey && stripeWebhookSecret
      ? "configured"
      : stripeSecretKey || stripeWebhookSecret
        ? "incomplete"
        : "missing";

  // Check Supabase tables and private storage bucket
  let savedAnalysesOk = false;
  let purchaseClaimsOk = false;
  let orderReportsOk = false;
  let privateBucketOk = false;

  try {
    const { error: e1 } = await supabaseAdmin.from("tw_saved_analyses").select("id").limit(1);
    savedAnalysesOk = readinessTableProbeSucceeded(e1);
  } catch {
    savedAnalysesOk = false;
  }

  try {
    const { error: e2 } = await supabaseAdmin.from("tw_purchase_claims").select("nonce").limit(1);
    purchaseClaimsOk = readinessTableProbeSucceeded(e2);
  } catch {
    purchaseClaimsOk = false;
  }

  try {
    const { error: e3 } = await supabaseAdmin.from("tw_order_reports").select("order_gid").limit(1);
    orderReportsOk = readinessTableProbeSucceeded(e3);
  } catch {
    orderReportsOk = false;
  }

  try {
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
    privateBucketOk = !bucketError && hasPrivateReportStorage(buckets);
  } catch {
    privateBucketOk = false;
  }

  const supabaseStatus =
    savedAnalysesOk && purchaseClaimsOk && orderReportsOk && privateBucketOk
      ? "configured"
      : savedAnalysesOk || purchaseClaimsOk || orderReportsOk || privateBucketOk
        ? "incomplete"
        : "missing";

  const offers = Object.values(REPORT_OFFERS).map((offer) => ({
    key: offer.key,
    sku: offer.sku,
    label: offer.label,
    priceUsd: offer.priceUsd,
    variantPinned: offer.variantGid !== null,
    // Source implementation is not evidence of a real paid-order → private PDF delivery.
    deliverableReady: false,
  }));

  const isReady =
    shopifyStatus === "configured" &&
    supabaseStatus === "configured";

  const launchHoldReason = !isReady
    ? "Launch hold active: Production Shopify credentials and Supabase private storage tables must be verified before releasing live paid reports."
    : null;

  return {
    evaluatedAt: new Date().toISOString(),
    isReady,
    launchHoldReason,
    shopify: {
      clientIdConfigured: shopifyClientId,
      clientSecretConfigured: shopifyClientSecret,
      webhookSecretConfigured: shopifyWebhookSecret,
      adminDomainConfigured: shopifyDomain,
      status: shopifyStatus,
    },
    stripe: {
      account: JUSSPAY_STRIPE_ACCOUNT,
      secretKeyConfigured: stripeSecretKey,
      webhookSecretConfigured: stripeWebhookSecret,
      status: stripeStatus,
    },
    supabase: {
      savedAnalysesTable: savedAnalysesOk,
      purchaseClaimsTable: purchaseClaimsOk,
      orderReportsTable: orderReportsOk,
      privateReportBucket: privateBucketOk,
      status: supabaseStatus,
    },
    catalog: {
      totalOffers: offers.length,
      offers,
    },
  };
}
