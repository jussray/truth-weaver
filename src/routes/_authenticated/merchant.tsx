import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, Package, ShoppingBag, ExternalLink, ShieldCheck, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NOTICE_OFFERS } from "@/lib/notice-offers";

const SHOPIFY_ADMIN = "https://admin.shopify.com/store/fcr-truth-weaver-esimv-203acj81";
const navigation = [
  { label: "Overview", href: "#overview", icon: LayoutDashboard },
  { label: "Products", href: "#products", icon: Package },
  { label: "Orders", href: "#orders", icon: ShoppingBag },
] as const;

export const Route = createFileRoute("/_authenticated/merchant")({
  head: () => ({ meta: [{ title: "Merchant Portal | Truth Weaver" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: MerchantPortal,
});

function MerchantPortal() {
  const { user } = Route.useRouteContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const access = useQuery({
    queryKey: ["merchant-access", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "merchant" });
      if (error) throw error;
      return data === true;
    },
    retry: false,
  });

  if (access.isPending) return <main className="min-h-screen bg-ink p-10 text-parchment" role="status">Checking merchant authorization…</main>;
  if (access.isError || !access.data) return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-parchment">
      <section className="max-w-lg rounded-2xl border border-gold/25 bg-forest-deep/50 p-8">
        <ShieldCheck className="mb-4 text-gold" aria-hidden="true" />
        <h1 className="font-serif text-3xl">Merchant access required</h1>
        <p className="mt-3 text-sm text-parchment/70">This workspace is restricted to authorized Truth Weaver merchants. No store data was loaded.</p>
        <Link to="/dashboard" className="mt-5 inline-block text-sm text-gold underline">Return to workspace</Link>
      </section>
    </main>
  );

  return (
    <div className="min-h-screen bg-ink text-parchment" data-testid="merchant-portal">
      <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-gold/15 bg-ink/95 px-5 backdrop-blur md:pl-72 md:pr-10">
        <div className="flex items-center gap-3">
          <button className="rounded-lg border border-gold/20 p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <div><p className="text-[10px] uppercase tracking-[.25em] text-gold">Truth Weaver / Merchant</p><h1 className="font-serif text-2xl">Commerce control</h1></div>
        </div>
        <div className="flex items-center gap-3"><span className="hidden text-xs text-parchment/50 sm:block">Authorized merchant</span><a href={SHOPIFY_ADMIN} target="_blank" rel="noopener noreferrer" className="rounded-full border border-gold/40 px-3 py-2 text-xs text-gold">Open Shopify <ExternalLink className="ml-1 inline" size={13} /></a></div>
      </header>
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-gold/15 bg-[#111c19] px-5 py-8 md:block ${menuOpen ? "block" : "hidden"}`}>
        <p className="mb-1 font-serif text-2xl text-gold">Truth Weaver</p><p className="mb-10 text-[10px] uppercase tracking-[.24em] text-parchment/50">Merchant operations</p>
        <nav aria-label="Merchant navigation" className="space-y-2">
          {navigation.map(({label,href,icon:Icon}) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-parchment/80 hover:bg-gold/10 hover:text-gold"><Icon size={18} />{label}</a>)}
        </nav>
        <div className="mt-12 border-t border-gold/15 pt-5 text-xs leading-6 text-parchment/55">Shopify is the source of truth for product prices, payment and order records. Publishing remains subject to launch verification.</div>
        <Link to="/dashboard" className="mt-6 inline-block text-xs text-gold underline">Customer workspace</Link>
      </aside>
      <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 md:ml-64 md:px-10">
        <section id="overview" className="scroll-mt-28">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-gold">Overview</p>
          <h2 className="mt-2 font-serif text-4xl">Merchant dashboard</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-parchment/65">Manage catalog and order operations through verified Shopify Admin links. This portal does not invent order totals or publish draft offers.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[["Catalog", "3 planned offers", "Not confirmed for sale"], ["Orders", "View in Shopify", "Live merchant order records"], ["Fulfillment", "Launch hold", "Private delivery verification pending"]].map(([title,value,note]) => <article key={title} className="rounded-2xl border border-gold/20 bg-forest-deep/40 p-5"><p className="text-xs text-parchment/60">{title}</p><p className="mt-3 font-serif text-2xl">{value}</p><p className="mt-2 text-xs text-gold-soft">{note}</p></article>)}
          </div>
        </section>
        <section id="products" className="scroll-mt-28 rounded-2xl border border-gold/20 bg-forest-deep/30 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-gold">Products</p><h2 className="mt-2 font-serif text-3xl">Pricing & catalog</h2></div><a href={SHOPIFY_ADMIN + "/products"} target="_blank" rel="noopener noreferrer" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink">Edit prices in Shopify <ExternalLink size={14} className="ml-1 inline" /></a></div>
          <p className="mt-3 text-sm text-parchment/65">The prices below are planned configuration values, not live Shopify prices. Use Shopify Admin to edit actual product variants, compare-at prices, and draft status.</p>
          <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-gold/20 text-xs uppercase tracking-widest text-gold-soft"><tr><th className="py-3">Product</th><th>Planned price</th><th>Publication</th><th className="text-right">Action</th></tr></thead><tbody>{Object.values(NOTICE_OFFERS).map(offer => <tr key={offer.sku} className="border-b border-gold/10"><td className="py-4 font-medium">{offer.label}<p className="mt-1 text-xs text-parchment/45">{offer.sku}</p></td><td>${offer.priceUsd}</td><td><span className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-200">Launch hold</span></td><td className="text-right"><a href={SHOPIFY_ADMIN + "/products"} target="_blank" rel="noopener noreferrer" className="text-gold underline">Edit in Shopify</a></td></tr>)}</tbody></table></div>
        </section>
        <section id="orders" className="scroll-mt-28 rounded-2xl border border-gold/20 bg-forest-deep/30 p-5 sm:p-7">
          <p className="text-xs uppercase tracking-[.2em] text-gold">Orders</p><h2 className="mt-2 font-serif text-3xl">Shopify order details</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-parchment/65">Open the authenticated Shopify merchant order list to inspect payment status, line items, customer details, refunds and fulfillment. Sensitive customer information is not fetched into this browser-only screen.</p>
          <div className="mt-6 rounded-xl border border-dashed border-gold/25 p-6"><ShoppingBag className="text-gold" /><p className="mt-3 font-semibold">Order records live in Shopify</p><p className="mt-2 text-sm text-parchment/60">No unverified order list or fabricated metrics are displayed here.</p><a href={SHOPIFY_ADMIN + "/orders"} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink">View order details <ExternalLink size={14} /></a></div>
        </section>
      </main>
    </div>
  );
}
