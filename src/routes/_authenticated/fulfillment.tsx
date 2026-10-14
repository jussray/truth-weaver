import { createFileRoute, Link } from "@tanstack/react-router";

import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { SnapshotDownloadPanel } from "@/components/commerce/snapshot-download-panel";

// Read back from the connected Truth Weaver Shopify Admin account on 2026-10-13.
// Shopify's Customer Accounts owns actual order identities and order data.
const SHOPIFY_CUSTOMER_ACCOUNT_URL = "https://shopify.com/85973860573/account";

export const Route = createFileRoute("/_authenticated/fulfillment")({
  head: () => ({
    meta: [
      { title: "Orders & fulfillment — Truth Weaver Counsel" },
      { name: "description", content: "Open your verified Shopify orders, tracking and returns." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FulfillmentPage,
});

function FulfillmentPage() {
  const { user } = Route.useRouteContext();
  return (
    <CounselPage title="Orders & fulfillment" eyebrow="Customer purchases" back={{ to: "/dashboard", label: "Dashboard" }}>
      <WorkspaceNav />
      <div className="grid gap-4 md:grid-cols-2">
        <section className={tw.card}>
          <p className={tw.label}>Your actual orders</p>
          <h2 className="mt-2 font-serif text-2xl">Check status with Shopify</h2>
          <p className="mt-3 text-sm leading-6 text-parchment/70">
            Sign into the store's verified Shopify customer account to see purchases associated with
            that Shopify identity, payment and fulfillment status, shipping tracking where supplied,
            digital-delivery details if provided, and return options when eligible.
          </p>
          <a href={SHOPIFY_CUSTOMER_ACCOUNT_URL} rel="noreferrer noopener" target="_blank" className={`${tw.btn} mt-5`}>
            View my Shopify orders
          </a>
          <p className="mt-3 text-xs text-parchment/50">
            Opens the official Shopify account for this Truth Weaver store. You may be asked to sign in separately.
          </p>
        </section>
        <section className={tw.card}>
          <p className={tw.label}>Delivery, tracking & returns</p>
          <h2 className="mt-2 font-serif text-2xl">Status comes from the merchant</h2>
          <p className="mt-3 text-sm leading-6 text-parchment/70">
            Physical deliveries may have carrier tracking. Downloadable products normally do not have
            shipping tracking numbers. Shopify will show return or refund actions only when offered
            for that particular order. Product-specific digital access remains unavailable until a
            verified paid-order entitlement and actual report delivery are implemented.
          </p>
          <div className="mt-4"><StateBox kind="empty">
            Truth Weaver has not connected your Supabase user to a Shopify customer or imported
            verified order records. No paid, shipped, delivered, refunded, or returned state is
            asserted inside this application.
          </StateBox></div>
        </section>
      </div>
      <div className="mt-5"><SnapshotDownloadPanel userId={user.id} /></div>
      <p className="mt-5 text-sm text-parchment/70">
        Looking to purchase a tool? <Link to="/shop" className="text-gold underline">Open the live catalog</Link>.
        Draft Snapshot, Deep Dive and Premium offers are still held from sale.
      </p>
    </CounselPage>
  );
}
