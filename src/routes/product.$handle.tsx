import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RelatedProducts } from "@/components/storefront/related-products";
import { SiteChrome } from "@/components/storefront/site-chrome";
import { fetchProductByHandle, formatPrice } from "@/lib/shopify";
import { isStorefrontVariantSellable } from "@/lib/commerce/storefront-launch-guard";
import { useCartStore } from "@/stores/cart-store";

export const Route = createFileRoute("/product/$handle")({
  head: () =>
    pageHead({ path: '/shop', title: 'Legal Tool | Truth Weaver Counsel', description: 'A legal guide, template or course from the Truth Weaver Counsel store.', noindex: true }),
  component: ProductPage,
});

function ProductPage() {
  const { handle } = Route.useParams();
  const q = useQuery({ queryKey: ["product", handle], queryFn: () => fetchProductByHandle(handle) });
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const [variantIdx, setVariantIdx] = useState(0);

  const p = q.data?.node;
  const variant = p?.variants.edges[variantIdx]?.node;
  const held = !!variant && !isStorefrontVariantSellable(variant.id, p?.tags);
  const purchasable = !!variant?.availableForSale && !held;

  return (
    <SiteChrome>
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
        {q.isLoading ? (
          <p className="text-parchment/60">Loading…</p>
        ) : !p ? (
          <p className="text-parchment/70">Product not found. <a href="/shop" className="text-gold underline">Back to shop</a></p>
        ) : (
          <div className="grid gap-10 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-gold/20 bg-ink">
              {p.images.edges[0] && <img src={p.images.edges[0].node.url} alt={p.images.edges[0].node.altText ?? p.title} className="w-full object-cover" />}
            </div>
            <div>
              <h1 className="font-serif text-4xl text-parchment">{p.title}</h1>
              <p className="mt-3 text-2xl font-semibold text-gold-soft">{variant ? formatPrice(variant.price) : formatPrice(p.priceRange.minVariantPrice)}</p>
              {p.variants.edges.length > 1 && (
                <select value={variantIdx} onChange={(e) => setVariantIdx(Number(e.currentTarget.value))} className="mt-5 rounded-xl border border-parchment/15 bg-ink px-3 py-2 text-parchment">
                  {p.variants.edges.map((v, i) => <option key={v.node.id} value={i}>{v.node.title}</option>)}
                </select>
              )}
              <p className="mt-5 whitespace-pre-line leading-7 text-parchment/75">{p.description}</p>
              <button
                disabled={isLoading || !purchasable}
                onClick={async () => {
                  if (!variant || !q.data || !purchasable) return;
                  const ok = await addItem({ product: q.data, variantId: variant.id, variantTitle: variant.title, price: variant.price, quantity: 1, selectedOptions: variant.selectedOptions });
                  if (ok) toast.success(`${p.title} added to cart`, { position: "top-center" });
                  else toast.error(`Couldn't add ${p.title}. Please try again.`, { position: "top-center" });
                }}
                className="mt-7 rounded-full bg-gold px-8 py-3 font-bold text-ink disabled:opacity-60"
              >
                {held ? "In development · Not for sale" : purchasable ? "Add to cart" : "Sold out"}
              </button>
              <p className="mt-6 text-xs leading-5 text-parchment/50">Educational tool, not legal advice. Governing law is the authority.</p>
            </div>
          </div>
        )}
        {p ? <RelatedProducts handle={p.handle} /> : null}
      </section>
    </SiteChrome>
  );
}
