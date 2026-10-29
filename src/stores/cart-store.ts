import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  addLineToShopifyCart,
  cartExists,
  fetchLiveCart,
  createShopifyCart,
  removeLineFromShopifyCart,
  updateShopifyCartLine,
  type ShopifyProduct,
} from "@/lib/shopify";

export interface CartItem {
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, "lineId">) => Promise<boolean>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  prepareCheckout: () => Promise<string | null>;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      // Returns true only when Shopify confirmed the line.
      addItem: async (item) => {
        const { items, cartId, clearCart } = get();
        const existing = items.find((i) => i.variantId === item.variantId);
        set({ isLoading: true });
        try {
          if (!cartId) {
            const r = await createShopifyCart(item.variantId, item.quantity);
            if (!r) return false;
            set({ cartId: r.cartId, checkoutUrl: r.checkoutUrl, items: [{ ...item, lineId: r.lineId }] });
            return true;
          }
          if (existing?.lineId) {
            const q = existing.quantity + item.quantity;
            const r = await updateShopifyCartLine(cartId, existing.lineId, q);
            if (r.success) {
              set({ items: get().items.map((i) => (i.variantId === item.variantId ? { ...i, quantity: q } : i)) });
              return true;
            }
            if (r.cartNotFound) clearCart();
            return false;
          }
          const r = await addLineToShopifyCart(cartId, item.variantId, item.quantity);
          if (r.success && r.lineId) {
            set({ items: [...get().items.filter((i) => i.variantId !== item.variantId), { ...item, lineId: r.lineId }] });
            return true;
          }
          if (r.cartNotFound) {
            clearCart();
            return get().addItem(item);
          }
          return false;
        } catch (e) {
          console.error("Failed to add item:", e);
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (variantId, quantity) => {
        if (quantity <= 0) return get().removeItem(variantId);
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item?.lineId || !cartId) return;
        set({ isLoading: true });
        try {
          const r = await updateShopifyCartLine(cartId, item.lineId, quantity);
          if (r.success) set({ items: get().items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)) });
          else if (r.cartNotFound) clearCart();
        } catch (e) {
          console.error("Failed to update quantity:", e);
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (variantId) => {
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item?.lineId || !cartId) return;
        set({ isLoading: true });
        try {
          const r = await removeLineFromShopifyCart(cartId, item.lineId);
          if (r.success) {
            const next = get().items.filter((i) => i.variantId !== variantId);
            if (next.length === 0) clearCart();
            else set({ items: next });
          } else if (r.cartNotFound) clearCart();
        } catch (e) {
          console.error("Failed to remove item:", e);
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),

      // Re-read the real Shopify cart, reconcile lines/prices/quantities, return its checkoutUrl.
      prepareCheckout: async () => {
        const { cartId, clearCart } = get();
        if (!cartId) return null;
        set({ isSyncing: true });
        try {
          const live = await fetchLiveCart(cartId);
          if (!live) {
            clearCart();
            return null;
          }
          const byVariant = new Map(live.lines.map((l) => [l.variantId, l]));
          set({
            checkoutUrl: live.checkoutUrl,
            items: get().items
              .filter((i) => byVariant.has(i.variantId))
              .map((i) => {
                const l = byVariant.get(i.variantId)!;
                return { ...i, lineId: l.lineId, quantity: l.quantity, price: l.price };
              }),
          });
          return live.checkoutUrl;
        } finally {
          set({ isSyncing: false });
        }
      },

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const ok = await cartExists(cartId);
          if (!ok) clearCart();
        } catch (e) {
          console.error("Failed to sync cart with Shopify:", e);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: "shopify-cart",
      storage: createJSONStorage(() => localStorage),
      // checkoutUrl is never persisted: prepareCheckout re-reads a validated URL from Shopify.
      partialize: (s) => ({ items: s.items, cartId: s.cartId }),
    },
  ),
);

export function useCartSync() {
  const syncCart = useCartStore((s) => s.syncCart);
  useEffect(() => {
    syncCart();
    const onVis = () => {
      if (document.visibilityState === "visible") syncCart();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [syncCart]);
}
