import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { authed } from "@/lib/merchant/authed-call";
import { listMerchantOrders, revealOrderCustomer } from "@/lib/merchant/portal.functions";

export const Route = createFileRoute("/merchant/orders")({
  head: () => ({ meta: [{ title: "Orders | Truth Weaver Merchant" }, { name: "description", content: "Truth Weaver Shopify orders with customer details hidden by default." }] }),
  component: OrdersPage,
});

type Orders = Awaited<ReturnType<typeof listMerchantOrders>>["orders"];
type Revealed = { email: string | null; customer: { displayName: string } | null; shippingAddress: { city: string | null; provinceCode: string | null; countryCodeV2: string | null } | null } | null;

function OrdersPage() {
  const [orders, setOrders] = useState<Orders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, Revealed | string>>({});

  useEffect(() => {
    authed(listMerchantOrders)
      .then((r) => { setOrders(r.orders); setError(r.error); })
      .catch(() => setError("Orders could not be loaded."));
  }, []);

  async function reveal(id: string) {
    const reason = window.prompt("Reason for viewing this customer's details (logged):");
    if (!reason || reason.trim().length < 5) return;
    const r = await authed(revealOrderCustomer, { orderId: id, reason }).catch(() => ({ ok: false as const, message: "Could not load details." }));
    setRevealed((m) => ({ ...m, [id]: r.ok ? r.customer : r.message }));
  }

  return (
    <section aria-labelledby="orders-h">
      <h1 id="orders-h" className="font-serif text-3xl">Orders</h1>
      <p className="mt-1 text-sm text-parchment/60">Customer details are hidden. Viewing them is recorded in the activity log.</p>
      {error && <div role="alert" className="mt-4 rounded-lg border border-warn/50 p-3 text-sm text-warn">{error}</div>}
      {!orders && !error && <p role="status" className="mt-6 text-parchment/60">Loading orders…</p>}
      {orders && orders.length === 0 && !error && <p className="mt-6 text-parchment/60">No orders yet.</p>}
      <div className="mt-6 grid gap-3">
        {orders?.map((o) => {
          const r = revealed[o.id];
          return (
            <article key={o.id} className="rounded-xl border border-gold/15 bg-forest-deep/30 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-lg">{o.name} {o.test && <span className="ml-1 rounded bg-warn/20 px-1.5 text-[11px] text-warn">TEST</span>}</h2>
                <span>{o.total.amount} {o.total.currencyCode}</span>
              </div>
              <p className="mt-1 text-parchment/60">{new Date(o.createdAt).toLocaleString()} · Payment: {o.financialStatus ?? "unknown"} · Fulfillment: {o.fulfillmentStatus ?? "unknown"}</p>
              <ul className="mt-2 text-parchment/80">{o.items.map((i, n) => <li key={n}>{i.quantity} × {i.title}</li>)}</ul>
              {r === undefined ? (
                <button type="button" onClick={() => reveal(o.id)} className="mt-3 text-xs text-gold underline">Reveal customer details</button>
              ) : typeof r === "string" ? (
                <p role="alert" className="mt-3 text-danger">{r}</p>
              ) : (
                <p className="mt-3 text-parchment/80">{r?.customer?.displayName ?? "No name"} · {r?.email ?? "No email"} · {[r?.shippingAddress?.city, r?.shippingAddress?.provinceCode, r?.shippingAddress?.countryCodeV2].filter(Boolean).join(", ") || "No address"}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
