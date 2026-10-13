import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { formatPrice, type ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cart-store";

export function ProductCard({ product }: { product: ShopifyProduct }) {
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const p = product.node;
  const variant = p.variants.edges[0]?.node;
  const img = p.images.edges[0]?.node;

  const add = async () => {
    if (!variant) return;
    const ok = await addItem({ product, variantId: variant.id, variantTitle: variant.title, price: variant.price, quantity: 1, selectedOptions: variant.selectedOptions });
    if (ok) toast.success(`${p.title} added to cart`, { position: "top-center" });
    else toast.error(`Couldn't add ${p.title}. Please try again.`, { position: "top-center" });
  };

  return (
    <article data-product-card className="flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-forest-deep/40">
      <Link to="/product/$handle" params={{ handle: p.handle }} className="block aspect-[4/3] bg-ink">
        {img ? <img src={img.url} alt={img.altText ?? p.title} className="h-full w-full object-cover" loading="lazy" /> : null}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link to="/product/$handle" params={{ handle: p.handle }} className="font-serif text-xl text-parchment hover:text-gold">{p.title}</Link>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-parchment/65">{p.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-semibold text-gold-soft">{formatPrice(p.priceRange.minVariantPrice)}</span>
          <button onClick={add} disabled={isLoading || !variant?.availableForSale} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink disabled:opacity-60">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : variant?.availableForSale ? "Add to cart" : "Sold out"}
          </button>
        </div>
      </div>
    </article>
  );
}
