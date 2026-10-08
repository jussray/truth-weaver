import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SiteChrome, StatusPill } from "@/components/storefront/site-chrome";
import { CONNECTOR_STATUS_LABEL } from "@/lib/connectors/registry";
import { useConnectorStatuses } from "@/lib/connectors/use-connector-status";

const searchSchema = z.object({
  category: z.string().optional(),
  area: z.string().optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Shop Legal Tools | Truth Weaver Counsel" },
      { name: "description", content: "Guides, templates, courses and bundles for understanding the law — sold through our Shopify store." },
      { property: "og:title", content: "Shop Legal Tools | Truth Weaver Counsel" },
      { property: "og:description", content: "Guides, templates, courses and bundles for understanding the law." },
    ],
  }),
  component: ShopPage,
});

const CATEGORIES = ["guides", "templates", "courses", "bundles"] as const;

function ShopPage() {
  const { category, area } = Route.useSearch();
  const { statuses } = useConnectorStatuses();
  const shopify = statuses.shopify;
  const live = shopify === "connected";

  return (
    <SiteChrome>
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-gold">Shop legal tools</p>
        <h1 className="mt-3 font-serif text-5xl text-parchment sm:text-6xl">
          {area ? area : category ? category.charAt(0).toUpperCase() + category.slice(1) : "The Counsel Store"}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-parchment/70">
          <span>Store connection</span>
          <StatusPill status={shopify} label={CONNECTOR_STATUS_LABEL[shopify]} />
        </div>

        {!live ? (
          <div data-shop-unavailable className="mt-8 max-w-2xl rounded-2xl border border-gold/25 bg-forest-deep/60 p-6 leading-7 text-parchment/80">
            <p className="font-serif text-2xl text-parchment">Our store isn’t connected yet.</p>
            <p className="mt-2">
              Products appear here once the Shopify store is linked. We don’t show sample products or prices that
              aren’t real. In the meantime you can explore legal areas and use the free legal research tool.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/#legal-areas" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink">Explore by legal area</a>
              <a href="/#legal-research" className="rounded-full border border-gold/40 px-5 py-2.5 text-sm font-bold text-gold-soft">Try legal research</a>
            </div>
          </div>
        ) : (
          <p className="mt-8 text-parchment/70">Store connected. Product listings load from Shopify.</p>
        )}

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <a
              key={c}
              href={`/shop?category=${c}`}
              aria-current={category === c ? "page" : undefined}
              className={`rounded-2xl border p-6 transition ${category === c ? "border-gold bg-gold/10" : "border-parchment/10 bg-forest-deep/40 hover:border-gold/50"}`}
            >
              <span className="font-serif text-2xl capitalize text-parchment">{c}</span>
              <span className="mt-2 block text-sm text-parchment/60">{live ? "Browse" : "Available when the store connects"}</span>
            </a>
          ))}
        </div>
        <p className="mt-10 max-w-3xl text-xs leading-5 text-parchment/50">
          Store products are educational tools. They are not legal advice, do not create a lawyer–client relationship,
          and never outrank the governing law of your jurisdiction.
        </p>
      </section>
    </SiteChrome>
  );
}
