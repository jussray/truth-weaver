import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { CounselPage, StateBox, WorkspaceNav, tw } from "@/components/counsel/page";
import { ProductCard } from "@/components/storefront/product-card";
import { listIssues } from "@/lib/counsel";
import { fetchProducts } from "@/lib/shopify";
import { NOTICE_OFFERS } from "@/lib/notice-offers";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Truth Weaver Counsel" },
      { name: "description", content: "Your saved legal issues and research history." },
      { property: "og:title", content: "Dashboard — Truth Weaver Counsel" },
      { property: "og:description", content: "Your private legal research workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const q = useQuery({ queryKey: ["issues"], queryFn: listIssues });
  const commerce = useQuery({ queryKey: ["products", "all"], queryFn: () => fetchProducts() });
  return (
    <CounselPage
      title="Your legal issues"
      eyebrow="Research workspace"
      actions={<Link to="/issues/new" className={tw.btn}>New issue</Link>}
    >
      <WorkspaceNav />
      <section className={`${tw.card} mb-6`} data-testid="dashboard-purchases">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={tw.label}>Purchases and fulfillment</p>
            <h2 className="mt-2 font-serif text-2xl">Your Shopify orders and available tools</h2>
            <p className="mt-2 max-w-2xl text-sm text-parchment/70">
              Shopify securely verifies your customer account and displays your actual order
              status, digital-delivery information, tracking if applicable, and any available return options.
              Your Truth Weaver research login does not automatically link Shopify orders.
            </p>
          </div>
          <Link to="/fulfillment" className={tw.ghost}>Orders and fulfillment</Link>
        </div>
        {commerce.isLoading ? <p className="mt-5 text-sm text-parchment/70">Checking live Shopify products...</p>
          : commerce.isError ? <StateBox kind="error">Live catalog unavailable. <Link to="/shop" className="underline">Open the store</Link>.</StateBox>
          : commerce.data?.length ? (
            <div data-testid="dashboard-shopify-products" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {commerce.data.slice(0, 3).map((p) => <ProductCard key={p.node.id} product={p} />)}
            </div>
          ) : (
            <div className="mt-5">
              <StateBox kind="empty">No published notice products are available to purchase. The current launch hold remains in place.</StateBox>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {Object.values(NOTICE_OFFERS).map((offer) => (
                  <article key={offer.sku} className="rounded-xl border border-gold/20 p-4">
                    <p className={tw.label}>Not yet for sale</p>
                    <h3 className="mt-2 font-serif text-lg">{offer.label}</h3>
                    <p className="mt-1 text-gold-soft">${offer.priceUsd} planned</p>
                  </article>
                ))}
              </div>
              <Link to="/shop" className={`${tw.ghost} mt-4`}>Visit Shopify storefront</Link>
            </div>
          )}
      </section>
      {q.isLoading && <StateBox kind="loading">Loading your issues…</StateBox>}
      {q.error && (
        <StateBox kind="error">
          Could not load issues: {(q.error as Error).message}{" "}
          <button className="underline" onClick={() => q.refetch()}>Retry</button>
        </StateBox>
      )}
      {q.data && q.data.length === 0 && (
        <StateBox kind="empty">No issues yet. Start one with “New issue”.</StateBox>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((i) => (
          <li key={i.id}>
            <Link to="/issues/$issueId" params={{ issueId: i.id }} className={`${tw.card} block hover:border-gold/50`}>
              <p className={tw.label}>{i.issue_area ?? "Unclassified"} · {i.status}</p>
              <h2 className="mt-1 font-serif text-xl">{i.title}</h2>
              <p className="mt-1 text-xs text-parchment/60">
                {i.jurisdiction_note || "Jurisdiction not set"} · as of {i.as_of_date ?? "not set"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </CounselPage>
  );
}
