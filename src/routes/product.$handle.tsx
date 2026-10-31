import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RelatedProducts } from "@/components/storefront/related-products";
import { SiteChrome } from "@/components/storefront/site-chrome";
import { fetchProductByHandle, formatPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cart-store";

export const Route = createFileRoute("/product/$handle")({
  head: () =>
    pageHead({ path: '/shop', title: 'Legal Tool | Truth Weaver Counsel', description: 'A legal guide, template or course from the Truth Weaver Counsel store.', noindex: true }), : formatPrice(p.priceRange.minVariantPrice)}</p>
              {p.variants.edges.length > 1 && (
                <select value={variantIdx} onChange={(e) => setVariantIdx(Number(e.currentTarget.value))} className="mt-5 rounded-xl border border-parchment/15 bg-ink px-3 py-2 text-parchment">
                  {p.variants.edges.map((v, i) => <option key={v.node.id} value={i}>{v.node.title}</option>)}
                </select>
              )}
              <p className="mt-5 whitespace-pre-line leading-7 text-parchment/75">{p.description}</p>
              <button
                disabled={isLoading || !variant?.availableForSale}
                onClick={async () => {
                  if (!variant || !q.data) return;
                  const ok = await addItem({ product: q.data, variantId: variant.id, variantTitle: variant.title, price: variant.price, quantity: 1, selectedOptions: variant.selectedOptions });
                  if (ok) toast.success(`${p.title} added to cart`, { position: "top-center" });
                  else toast.error(`Couldn't add ${p.title}. Please try again.`, { position: "top-center" });
                }}
                className="mt-7 rounded-full bg-gold px-8 py-3 font-bold text-ink disabled:opacity-60"
              >
                {variant?.availableForSale ? "Add to cart" : "Sold out"}
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
