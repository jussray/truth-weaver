import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, FileText, GraduationCap, Package } from "lucide-react";
import { z } from "zod";

import { ProductCard } from "@/components/storefront/product-card";
import { SiteChrome } from "@/components/storefront/site-chrome";
import { NOTICE_OFFERS } from "@/lib/notice-offers";
import { SHOP_CATEGORIES, buildShopQuery, findCategory, type ShopCategory } from "@/lib/shop-categories";
import { fetchProducts } from "@/lib/shopify";

const searchSchema = z.object({
  category: z.string().optional(),
  area: z.string().max(80).optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () =>
    pageHead({ path: '/shop', title: 'Legal Guides, Templates & Courses | Truth Weaver Counsel', description: 'Guides, templates, courses and bundles that help you understand the law and check official sources. Items marked not for sale are still being prepared.', breadcrumbs: [{ name: "Home", path: "/" }, { name: 'Shop', path: '/shop' }] }),
  component: ShopPage,
});

const ICONS: Record<ShopCategory["slug"], typeof BookOpen> = {
  guides: BookOpen,
  templates: FileText,
  courses: GraduationCap,
  bundles: Package,
};

function ShopPage() {
  const { category: categorySlug, area } = Route.useSearch();
  const category = findCategory(categorySlug);
  const query = buildShopQuery(category?.slug, area);
  const q = useQuery({ queryKey: ["products", query ?? "all"], queryFn: () => fetchProducts(query) });
  const products = q.data ?? [];
  const pill = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${active ? "border-gold bg-gold/10 text-gold" : "border-parchment/15 text-parchment/70 hover:border-gold/50"}`;

  return (
    <SiteChrome>
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-gold">Shop legal tools</p>
        <h1 className="mt-3 break-words font-serif text-4xl text-parchment sm:text-6xl">
          {category ? category.label : area ? area : "The Counsel Store"}
        </h1>
        {area && category ? <p className="mt-2 text-parchment/70">Legal area: {area}</p> : null}

        <nav aria-label="Store categories" className="mt-8 flex flex-wrap gap-2">
          <a href={area ? `/shop?area=${encodeURIComponent(area)}` : "/shop"} aria-current={!category ? "page" : undefined} className={pill(!category)}>All</a>
          {SHOP_CATEGORIES.map((c) => {
            const href = `/shop?category=${c.slug}${area ? `&area=${encodeURIComponent(area)}` : ""}`;
            return <a key={c.slug} href={href} aria-current={category?.slug === c.slug ? "page" : undefined} className={pill(category?.slug === c.slug)}>{c.label}</a>;
          })}
        </nav>

        {category ? <CategoryIntro category={category} /> : !area ? <CategoryOverview /> : null}

        {q.isLoading ? (
          <p role="status" className="mt-10 text-parchment/60">Loading products…</p>
        ) : q.error ? (
          <p data-shop-unavailable role="alert" className="mt-10 text-parchment/70">The store couldn't be reached right now. Please try again shortly.</p>
        ) : products.length === 0 ? (
          <div data-shop-unavailable className="mt-10 max-w-2xl rounded-2xl border border-gold/25 bg-forest-deep/60 p-6 leading-7 text-parchment/80">
            <p className="font-serif text-2xl text-parchment">No products found</p>
            <p className="mt-2">
              {category
                ? `No ${category.label.toLowerCase()} are for sale yet${area ? ` for ${area}` : ""}. We only list items once they are finished and can be delivered.`
                : "Nothing is listed here yet. Meanwhile you can explore legal areas or try the free legal research tool."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/notice-analyzer" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink">Analyze a notice free</a>
              <a href="/#legal-research" className="rounded-full border border-gold/40 px-5 py-2.5 text-sm font-bold text-gold-soft">Try legal research</a>
            </div>
          </div>
        ) : (
          <div data-product-grid className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => <ProductCard key={p.node.id} product={p} />)}
          </div>
        )}

        {!q.isLoading && !category && products.length === 0 ? (
          <section data-testid="notice-offer-previews" aria-label="Planned notice products" className="mt-10">
            <h2 className="font-serif text-2xl text-parchment">Notice tools in preparation</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-parchment/65">
              These are planned prices, not active offers. Purchases open only when report delivery, access controls and payments have been verified.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {Object.values(NOTICE_OFFERS).map((offer) => (
                <article key={offer.sku} data-testid="notice-offer-preview" className="rounded-2xl border border-gold/25 bg-forest-deep/40 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">In development · Not for sale</p>
                  <h3 className="mt-3 font-serif text-xl text-parchment">{offer.label}</h3>
                  <p className="mt-2 text-2xl font-bold text-gold-soft">${offer.priceUsd} planned</p>
                  <p className="mt-3 text-sm leading-6 text-parchment/70">{offer.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <p className="mt-12 max-w-3xl text-xs leading-5 text-parchment/50">
          Store products are educational tools. They are not legal advice, do not create a lawyer–client relationship,
          and never outrank the governing law of your jurisdiction.
        </p>
      </section>
    </SiteChrome>
  );
}

function CategoryIntro({ category }: { category: ShopCategory }) {
  const Icon = ICONS[category.slug];
  return (
    <section data-testid="category-intro" aria-label={`About ${category.label}`} className="mt-8 grid gap-6 rounded-2xl border border-gold/20 bg-forest-deep/40 p-6 md:grid-cols-[1fr_1fr]">
      <div>
        <Icon className="h-7 w-7 text-gold" aria-hidden />
        <p className="mt-3 max-w-xl leading-7 text-parchment/80">{category.summary}</p>
      </div>
      <div>
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gold-soft">Each one includes</h2>
        <ul className="mt-3 space-y-2">
          {category.includes.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-parchment/80"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CategoryOverview() {
  return (
    <section aria-label="Browse by type" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SHOP_CATEGORIES.map((c) => {
        const Icon = ICONS[c.slug];
        return (
          <a key={c.slug} href={`/shop?category=${c.slug}`} data-testid="category-card" className="group rounded-2xl border border-gold/20 bg-forest-deep/40 p-5 transition hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            <Icon className="h-6 w-6 text-gold" aria-hidden />
            <h2 className="mt-3 font-serif text-2xl text-parchment group-hover:text-gold">{c.label}</h2>
            <p className="mt-2 text-sm leading-6 text-parchment/65">{c.summary}</p>
          </a>
        );
      })}
    </section>
  );
}
