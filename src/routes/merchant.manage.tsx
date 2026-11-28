import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { supabase } from "@/integrations/supabase/client";
import { confirmationPhrase, LAUNCH_HOLD_SKUS } from "@/lib/merchant/policy";
import {
  readMerchantDashboard,
  changeMerchantProductStatus,
  changeMerchantVariantPrice,
  readMerchantPaidReportReadiness,
} from "@/lib/merchant/portal.functions";
import type { MerchantProduct, MerchantOrder } from "@/lib/merchant/portal.server";
import type { PaidReportReadiness } from "@/lib/merchant/paid-report-readiness.server";

type Status = "ACTIVE" | "DRAFT" | "ARCHIVED";
type Dashboard = { products: MerchantProduct[]; productsHasMore: boolean; orders: MerchantOrder[]; ordersUnavailable: boolean };

export const Route = createFileRoute("/merchant/manage")({
  head: () => ({ meta: [{ title: "Truth Weaver merchant management" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: MerchantPage,
});

async function currentToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to Truth Weaver again.");
  return data.session.access_token;
}

function MerchantPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [readiness, setReadiness] = useState<PaidReportReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const token = await currentToken();
      const [dashResult, readyResult] = await Promise.all([
        readMerchantDashboard({ data: { authAccessToken: token } }),
        readMerchantPaidReportReadiness({ data: { authAccessToken: token } }),
      ]);
      setDashboard(dashResult);
      setReadiness(readyResult);
      setDenied(false);
    } catch {
      setDashboard(null);
      setReadiness(null);
      setDenied(true);
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  return (
    <CounselPage title="Merchant management" eyebrow="Verified merchant role required" back={{ to: "/account", label: "Account" }}>
      <WorkspaceNav />
      <p className="mb-5 text-sm text-parchment/70">
        Shopify is the source of truth. Every change requires an independently verified merchant role,
        exact per-item confirmation, an audit receipt, and fresh Shopify readback.
        This screen never changes banking or payout settings.
      </p>
      {loading && <StateBox kind="loading">Checking Shopify, JussPay, and merchant authorization...</StateBox>}
      {!loading && denied && <StateBox kind="error">Merchant access denied or Shopify Admin is unavailable. Nothing was changed.</StateBox>}
      {dashboard && (
        <>
          <section className={tw.card}>
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-serif text-2xl">Products and prices</h2>
              <button type="button" className={tw.ghost} onClick={() => void refresh()}>Refresh from Shopify</button>
            </div>
            {dashboard.productsHasMore && <p>First 30 products only. This is not the entire catalog.</p>}
            {!dashboard.products.length && <StateBox kind="empty">No products returned.</StateBox>}
            <div className="mt-4 grid gap-4">
              {dashboard.products.map(p => <ProductEditor key={p.id} product={p} onSaved={refresh} />)}
            </div>
          </section>

          {readiness && <PaidReportReadinessSection readiness={readiness} onRefresh={refresh} />}

          <section className={tw.card + " mt-6"}>
            <h2 className="font-serif text-2xl">Orders</h2>
            <p className="mt-2 text-sm text-parchment/70">Provider statuses only. No customer names or addresses are retrieved. Refunds, cancellations, and shipping changes stay in Shopify Admin.</p>
            {dashboard.ordersUnavailable ? <StateBox kind="error">Shopify order readback unavailable, not a zero-order result.</StateBox> :
              dashboard.orders.length === 0 ? <StateBox kind="empty">No orders returned by Shopify.</StateBox> :
              <ul className="mt-3 space-y-2">{dashboard.orders.map(o =>
                <li key={o.id} className="rounded-lg border border-gold/20 p-3">
                  <strong>{o.name}</strong> · {o.createdAt} · {o.test ? "Test order" : "Provider order"}
                  <p className="text-sm">Payment: {o.displayFinancialStatus ?? "Unknown"} · Fulfillment: {o.displayFulfillmentStatus ?? "Unknown"}</p>
                  <p className="text-sm">{o.totalPriceSet.shopMoney.amount} {o.totalPriceSet.shopMoney.currencyCode}</p>
                </li>)}</ul>}
            <a className={tw.ghost + " mt-4 inline-block"} href="https://admin.shopify.com/" rel="noopener noreferrer" target="_blank">Manage orders in Shopify Admin</a>
          </section>
        </>
      )}
    </CounselPage>
  );
}

function PaidReportReadinessSection({ readiness, onRefresh }: { readiness: PaidReportReadiness; onRefresh: () => Promise<void> }) {
  return (
    <section className={tw.card + " mt-6"} aria-labelledby="readiness-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={tw.label}>Paid report release gate</p>
          <h2 id="readiness-heading" className="mt-1 font-serif text-2xl">Fulfillment & credential readiness</h2>
        </div>
        <button type="button" className={tw.ghost} onClick={() => void onRefresh()}>Recheck credentials</button>
      </div>

      <div className="mt-4">
        {readiness.isReady ? (
          <StateBox kind="empty">
            Credential and private-storage prerequisites were detected. This does not verify custom-app installation, live payment, or order-specific PDF delivery. Keep products on launch hold until end-to-end proof.
          </StateBox>
        ) : (
          <StateBox kind="error">
            {readiness.launchHoldReason ?? "Launch hold active: Required credentials or private storage tables remain unverified."}
          </StateBox>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gold/20 p-3">
          <p className="text-xs uppercase tracking-wider text-gold">Shopify Custom App</p>
          <p className="mt-1 font-serif text-lg">Status: {readiness.shopify.status}</p>
          <ul className="mt-2 space-y-1 text-xs text-parchment/70">
            <li>Client ID: {readiness.shopify.clientIdConfigured ? "Configured" : "Missing"}</li>
            <li>Client Secret: {readiness.shopify.clientSecretConfigured ? "Configured" : "Missing"}</li>
            <li>Webhook Secret: {readiness.shopify.webhookSecretConfigured ? "Configured" : "Missing"}</li>
          </ul>
        </div>

        <div className="rounded-lg border border-gold/20 p-3">
          <p className="text-xs uppercase tracking-wider text-gold">JussPay Stripe Core</p>
          <p className="mt-1 font-serif text-lg">Status: {readiness.stripe.status}</p>
          <ul className="mt-2 space-y-1 text-xs text-parchment/70">
            <li>Account: <code>{readiness.stripe.account}</code></li>
            <li>Secret Key: {readiness.stripe.secretKeyConfigured ? "Configured" : "Missing"}</li>
            <li>Webhook Secret: {readiness.stripe.webhookSecretConfigured ? "Configured" : "Missing"}</li>
          </ul>
        </div>

        <div className="rounded-lg border border-gold/20 p-3">
          <p className="text-xs uppercase tracking-wider text-gold">Supabase Infrastructure</p>
          <p className="mt-1 font-serif text-lg">Status: {readiness.supabase.status}</p>
          <ul className="mt-2 space-y-1 text-xs text-parchment/70">
            <li>Saved analyses: {readiness.supabase.savedAnalysesTable ? "Table present" : "Table missing"}</li>
            <li>Purchase claims: {readiness.supabase.purchaseClaimsTable ? "Table present" : "Table missing"}</li>
            <li>Order reports: {readiness.supabase.orderReportsTable ? "Table present" : "Table missing"}</li>
            <li>Private bucket: {readiness.supabase.privateReportBucket ? "Bucket present" : "Bucket missing"}</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-gold/20 p-3">
        <p className="text-xs uppercase tracking-wider text-gold">Catalog deliverables ({readiness.catalog.totalOffers} products)</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {readiness.catalog.offers.map((offer) => (
            <div key={offer.key} className="rounded border border-parchment/15 p-2 text-xs">
              <p className="font-semibold text-parchment">{offer.label} (${offer.priceUsd})</p>
              <p className="text-parchment/60">SKU: {offer.sku}</p>
              <p className="text-parchment/60">Status: {offer.variantPinned ? "Shopify variant pinned (delivery unverified)" : "Shopify variant not pinned — launch held"}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductEditor({ product, onSaved }: { product: MerchantProduct; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<Status>(product.status);
  const [statusProof, setStatusProof] = useState("");
  const [priceFields, setPriceFields] = useState<Record<string, string>>({});
  const [priceProofs, setPriceProofs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const held = product.variants.nodes.some((v) => v.sku !== null && LAUNCH_HOLD_SKUS.includes(v.sku));
  const statusPhrase = confirmationPhrase("status", product.id, status);

  useEffect(() => {
    setStatus(product.status);
    setStatusProof("");
    setPriceFields({});
    setPriceProofs({});
  }, [product]);

  async function applyStatus() {
    if (busy || statusProof !== statusPhrase) return;
    setBusy(true); setMessage("");
    try {
      const r = await changeMerchantProductStatus({
        data: { authAccessToken: await currentToken(), productId: product.id, nextStatus: status, confirmation: statusProof, expectedCurrentStatus: product.status },
      });
      setMessage(r.unchanged ? "Status unchanged in Shopify." : "Shopify status readback verified.");
      setStatusProof("");
      await onSaved();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Status unverified. Do not retry automatically."); }
    finally { setBusy(false); }
  }

  async function applyPrice(variantId: string, current: string) {
    const requested = priceFields[variantId] ?? current;
    const phrase = confirmationPhrase("price", variantId, requested);
    if (busy || priceProofs[variantId] !== phrase) return;
    setBusy(true); setMessage("");
    try {
      const r = await changeMerchantVariantPrice({
        data: { authAccessToken: await currentToken(), productId: product.id, variantId, price: requested, confirmation: phrase, expectedCurrentPrice: current },
      });
      setMessage(r.unchanged ? "Price unchanged in Shopify." : "Shopify price readback verified.");
      setPriceProofs(p => ({ ...p, [variantId]: "" }));
      await onSaved();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Price unverified. Do not retry automatically."); }
    finally { setBusy(false); }
  }

  return (
    <article className="rounded-xl border border-gold/25 p-4">
      <h3 className="font-serif text-xl">{product.title}</h3>
      <p className="mt-1 text-sm">Shopify status: {product.status}</p>
      {held && <p className="text-sm text-gold">Launch hold: activation blocked pending verified delivery and paid-order proof.</p>}
      {message && <p role="status" className="my-2 text-sm">{message}</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className="text-sm">Status
          <select value={status} className="mt-1 w-full rounded border border-gold/25 bg-ink p-2"
            onChange={e => setStatus(e.target.value as Status)}>
            <option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option>
            <option value="ACTIVE" disabled={held}>Active</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">Type confirmation: <code>{statusPhrase}</code>
          <input autoComplete="off" className="mt-1 w-full rounded border border-gold/25 bg-ink p-2" value={statusProof}
            onChange={e => setStatusProof(e.target.value)}/>
        </label>
        <button type="button" className={tw.ghost} disabled={busy || (held && status === "ACTIVE") || statusProof !== statusPhrase}
          onClick={() => void applyStatus()}>Confirm status</button>
      </div>
      <div className="mt-5 grid gap-3">
        {product.variants.nodes.map(v => {
          const target = priceFields[v.id] ?? v.price;
          const phrase = confirmationPhrase("price", v.id, target);
          return (
            <div key={v.id} className="grid gap-2 rounded-lg border border-parchment/15 p-3 sm:grid-cols-3">
              <p className="text-sm">SKU: {v.sku ?? "not set"}<br/>Price: {"$" + v.price}</p>
              <label className="text-sm">New USD price
                <input inputMode="decimal" className="mt-1 w-full rounded border border-gold/25 bg-ink p-2" value={target}
                  onChange={e => setPriceFields(p => ({ ...p, [v.id]: e.target.value }))}/>
              </label>
              <div className="space-y-2">
                <label className="block text-xs">Type confirmation: <code>{phrase}</code>
                  <input autoComplete="off" className="mt-1 w-full rounded border border-gold/25 bg-ink p-2"
                    value={priceProofs[v.id] ?? ""} onChange={e => setPriceProofs(p => ({ ...p, [v.id]: e.target.value }))}/>
                </label>
                <button type="button" className={tw.ghost} disabled={busy || priceProofs[v.id] !== phrase}
                  onClick={() => void applyPrice(v.id, v.price)}>Confirm price</button>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
