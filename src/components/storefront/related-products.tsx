import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { ProductCard } from "@/components/storefront/product-card";
import { getRecommendations } from "@/lib/recommendations.functions";

export interface RelatedProductsProps {
  /** Shopify handle of the product being viewed. */
  handle: string;
}

/** "You may also like": AI-ranked picks from the real catalog, with a labeled category fallback. */
export function RelatedProducts({ handle }: RelatedProductsProps) {
  const q = useQuery({
    queryKey: ["recommendations", handle],
    queryFn: () => getRecommendations({ data: { handle } }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (q.isLoading) {
    return (
      <section aria-labelledby="related-h" aria-busy="true" className="mt-16">
        <h2 id="related-h" className="font-serif text-3xl text-parchment">You may also like</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl border border-gold/10 bg-forest-deep/30" />)}
        </div>
      </section>
    );
  }

  const data = q.data;
  if (!data || data.items.length === 0) return null;

  return (
    <section aria-labelledby="related-h" data-testid="related-products" data-mode={data.mode} className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="related-h" className="font-serif text-3xl text-parchment">You may also like</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
          {data.mode === "ai" ? <><Sparkles className="h-3.5 w-3.5" aria-hidden /> Picked by AI from this store</> : "Matched by category"}
        </span>
      </div>
      {data.notice && <p className="mt-2 text-sm text-parchment/60">{data.notice}</p>}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((r) => (
          <div key={r.product.node.id} className="flex flex-col gap-2">
            <ProductCard product={r.product} />
            <p className="px-1 text-xs leading-5 text-parchment/60">{r.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
