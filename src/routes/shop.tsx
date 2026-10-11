import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { ProductCard } from "@/components/storefront/product-card";
import { SiteChrome } from "@/components/storefront/site-chrome";
import { fetchProducts } from "@/lib/shopify";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopPage,
});

const CATEGORIES = ["guides", "templates", "courses", "bundles"] as const;

// Category -> product_type, legal area -> product tag (set in Shopify).
function buildQuery(category?: string, area?: string) {
  const parts: string[] = [];
  if (category) parts.push(`product_type:${category}`);
  if (area) parts.push(`tag:"${area.replace(/"/g, "")}"`);
  return parts.length ? parts.join(" AND ") : undefined;
}

function ShopPage() {
  const { category, area } = Route.useSearch();
  const query = buildQuery(category, area);
  const q = useQuery({ queryKey: ["products", query ?? "all"], queryFn: () => fetchProducts(query) });
  const products = q.data ?? [];

  return (
    <SiteChrome>
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-gold">Shop legal tools</p>
        <h1 className="mt-3 font-serif text-5xl text-parchment sm:text-6xl">
          {area ? area : category ? category.charAt(0).toUpperCase() + category.slice(1) : "The Counsel Store"}
        </h1>

        <div className="mt-8 flex flex-wrap gap-2">
          <a href="/shop" className={`rounded-full border px-4 py-1.5 text-sm ${!category && !area ? "border-gold bg-gold/10 text-gold" : "border-parchment/15 text-parchment/70 hover:border-gold/50"}`}>All</a>
          {CATEGORIES.map((c) => (
            <a key={c} href={`/shop?category=${c}`} aria-current={category === c ? "page" : undefined} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${category === c ? "border-gold bg-gold/10 text-gold" : "border-parchment/15 text-parchment/70 hover:border-gold/50"}`}>{c}</a>
          ))}
        </div>

        {q.isLoading ? (
          <p className="mt-10 text-parchment/60">Loading products…</p>
        ) : q.error ? (
          <p data-shop-unavailable className="mt-10 text-parchment/70">The store couldn't be reached right now. Please try again shortly.</p>
        ) : products.length === 0 ? (
          <div data-shop-unavailable className="mt-10 max-w-2xl rounded-2xl border border-gold/25 bg-forest-deep/60 p-6 leading-7 text-parchment/80">
            <p className="font-serif text-2xl text-parchment">No products found</p>
            <p className="mt-2">Nothing is listed here yet. Meanwhile you can explore legal areas or try the free legal research tool.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/#legal-areas" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink">Explore by legal area</a>
              <a href="/#legal-research" className="rounded-full border border-gold/40 px-5 py-2.5 text-sm font-bold text-gold-soft">Try legal research</a>
            </div>
          </div>
        ) : (
          <div data-product-grid className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => <ProductCard key={p.node.id} product={p} />)}
          </div>
        )}

        <p className="mt-12 max-w-3xl text-xs leading-5 text-parchment/50">
          Store products are educational tools. They are not legal advice, do not create a lawyer–client relationship,
          and never outrank the governing law of your jurisdiction.
        </p>
      </section>
    </SiteChrome>
  );
}
