import { pageHead } from "@/lib/seo";
import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, Lock, Package, ScrollText, ShieldCheck, Search, FileQuestion } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { authed } from "@/lib/merchant/authed-call";
import { getMerchantAccess } from "@/lib/merchant/portal.functions";

export const Route = createFileRoute("/merchant")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: location.pathname } });
    return { email: data.user.email ?? "" };
  },
  head: () =>
    pageHead({ path: '/merchant', title: 'Merchant Portal | Truth Weaver', description: 'Private Truth Weaver account page.', noindex: true }),
  component: MerchantLayout,
});

const NAV = [
  { to: "/merchant/products", label: "Products", icon: Package },
  { to: "/merchant/orders", label: "Orders", icon: ClipboardList },
  { to: "/merchant/audit-log", label: "Activity log", icon: ScrollText },
  { to: "/merchant/search-console", label: "Search Console", icon: Search },
  { to: "/merchant/claim-review", label: "Evidence challenge", icon: FileQuestion },
] as const;

function MerchantLayout() {
  const { email } = Route.useRouteContext();
  const [access, setAccess] = useState<"checking" | "yes" | "no" | "error">("checking");

  useEffect(() => {
    authed(getMerchantAccess)
      .then((r) => setAccess(r.isMerchant ? "yes" : "no"))
      .catch(() => setAccess("error"));
  }, []);

  if (access === "checking") {
    return <div role="status" className="grid min-h-screen place-items-center bg-ink text-parchment/70">Checking merchant access…</div>;
  }
  if (access !== "yes") {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6">
        <div data-testid="merchant-restricted" role="alert" className="max-w-md rounded-2xl border border-gold/30 bg-forest-deep/40 p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-gold" aria-hidden />
          <h1 className="mt-4 font-serif text-2xl text-parchment">Access restricted</h1>
          <p className="mt-2 text-sm text-parchment/70">
            {access === "error" ? "Merchant access could not be checked. Try again shortly." : "Merchant authorization is required to open this portal."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard" className="rounded-full border border-gold/40 px-4 py-2 text-sm text-parchment hover:text-gold">Dashboard</Link>
            <Link to="/shop" className="rounded-full border border-gold/40 px-4 py-2 text-sm text-parchment hover:text-gold">Shop</Link>
            <Link to="/vendor-invite" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink">I have a vendor invite</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-parchment md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-gold/15 bg-forest-deep/60 p-4 md:min-h-screen md:border-b-0 md:border-r">
        <Link to="/" className="block font-serif text-xl text-gold">Truth Weaver</Link>
        <p className="text-[11px] uppercase tracking-[0.2em] text-parchment/50">Merchant portal</p>
        <nav aria-label="Merchant" className="mt-6 flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-parchment/75 hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              activeProps={{ className: "bg-gold/15 text-gold" }}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/15 px-5 py-4">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-gold">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Every change is confirmed and logged
          </span>
          <span className="text-sm text-parchment/60">{email}</span>
        </header>
        <main className="p-5 sm:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
