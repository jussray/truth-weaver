import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cart-store";

export function CartDrawer({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { items, isLoading, isSyncing, updateQuantity, removeItem, getCheckoutUrl, syncCart } = useCartStore();
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + parseFloat(i.price.amount) * i.quantity, 0);
  const currency = items[0]?.price.currencyCode ?? "USD";

  useEffect(() => {
    if (open) syncCart();
  }, [open, syncCart]);

  const checkout = () => {
    const url = getCheckoutUrl();
    if (url) {
      window.open(url, "_blank");
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button data-testid="cart-button" aria-label="Cart" className={compact ? "relative rounded-full p-2 text-parchment/75 hover:text-gold" : "relative flex items-center gap-1.5 hover:text-gold"}>
          <ShoppingBag className={compact ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
          {!compact && "Cart"}
          {totalItems > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">{totalItems}</span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col border-gold/20 bg-ink text-parchment sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-serif text-parchment">Your cart</SheetTitle>
          <SheetDescription className="text-parchment/60">
            {totalItems === 0 ? "Your cart is empty" : `${totalItems} item${totalItems !== 1 ? "s" : ""}`}
          </SheetDescription>
        </SheetHeader>
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-parchment/50">Nothing here yet.</div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-forest-deep">
                    {item.product.node.images.edges[0]?.node && <img src={item.product.node.images.edges[0].node.url} alt={item.product.node.title} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.product.node.title}</p>
                    <p className="text-xs text-parchment/55">{item.selectedOptions.map((o) => o.value).join(" • ")}</p>
                    <p className="font-semibold text-gold-soft">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button aria-label="Remove" onClick={() => removeItem(item.variantId)} className="text-parchment/50 hover:text-gold"><Trash2 className="h-4 w-4" /></button>
                    <div className="flex items-center gap-1">
                      <button aria-label="Decrease" onClick={() => updateQuantity(item.variantId, item.quantity - 1)} className="rounded border border-parchment/20 p-1"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button aria-label="Increase" onClick={() => updateQuantity(item.variantId, item.quantity + 1)} className="rounded border border-parchment/20 p-1"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4 border-t border-gold/15 pt-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatPrice({ amount: String(total), currencyCode: currency })}</span>
              </div>
              <button onClick={checkout} disabled={isLoading || isSyncing} className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3 font-bold text-ink disabled:opacity-60">
                {isLoading || isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4" /> Checkout with Shopify</>}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
