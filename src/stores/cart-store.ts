import { useEffect } from "react";
import { isStorefrontVariantSellable } from "@/lib/commerce/storefront-launch-guard";
import { supabase } from "@/integrations/supabase/client";
import { createMyPurchaseClaim } from "@/lib/commerce/order-report.functions";
import { CLAIM_ATTRIBUTE_KEY, SAVED_ANALYSIS_SESSION_KEY, isReportVariant } from "@/lib/commerce/report-catalog";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  addLineToShopifyCart,
  attachReportClaimToCart,
  clearReportClaimFromCart,
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
  getCheckoutUrl: () => string | null;
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
        if (!isStorefrontVariantSellable(item.variantId, item.product.node.tags)) return false;
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
        if (!item?.lineId || !cartId || !isStorefrontVariantSellable(variantId, item.product.node.tags)) return;
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
      getCheckoutUrl: () => get().items.some((i) => !isStorefrontVariantSellable(i.variantId, i.product.node.tags))
        ? null : get().checkoutUrl,

      // Re-read the real Shopify cart, reconcile lines/prices/quantities, return its checkoutUrl.
      prepareCheckout: async () => {
        const { cartId, clearCart, items } = get();
        if (!cartId || items.some((i) => !isStorefrontVariantSellable(i.variantId, i.product.node.tags))) return null;
        set({ isSyncing: true });
        try {
          const live = await fetchLiveCart(cartId);
          if (!live) {
            clearCart();
            return null;
          }
          if (live.lines.some((line) => !isStorefrontVariantSellable(line.variantId, line.tags))) return null;
          if (live.lines.some((line) => isReportVariant(line.variantId) && line.quantity !== 1))
            throw new Error("Each personalized report must have quantity one before checkout.");
          let verifiedLive = live;
          if (live.lines.some((line) => isReportVariant(line.variantId))) {
            // Only the signed-in owner of a server-saved analysis can initiate a report purchase.
            const analysisId = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(SAVED_ANALYSIS_SESSION_KEY);
            if (!analysisId) throw new Error("Analyze and privately save a notice before purchasing a personalized report.");
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) throw new Error("Sign in before purchasing a personalized report.");
            const claim = await createMyPurchaseClaim({
              data: { analysisId },
              headers: { Authorization: `Bearer ${token}` },
            });
            if (claim.state !== "ok") throw new Error("We could not verify your saved analysis. Report checkout is unavailable.");
            if (!(await attachReportClaimToCart(cartId, claim.nonce, live.attributes)))
              throw new Error("Shopify did not accept the order-to-analysis binding. No checkout started.");
            const confirmed = await fetchLiveCart(cartId);
            if (!confirmed || confirmed.attributes.filter((a) => a.key === CLAIM_ATTRIBUTE_KEY && a.value === claim.nonce).length !== 1)
              throw new Error("Shopify did not confirm the report claim. No checkout started.");
            verifiedLive = confirmed;
          } else if (live.attributes.some((a) => a.key === CLAIM_ATTRIBUTE_KEY)) {
            // A report item may have been removed from a previously claimed cart.
            // Never carry its old entitlement hint into an unrelated purchase.
            if (!(await clearReportClaimFromCart(cartId, live.attributes)))
              throw new Error("Shopify did not clear the old report binding. No checkout started.");
            const confirmed = await fetchLiveCart(cartId);
            if (!confirmed || confirmed.attributes.some((a) => a.key === CLAIM_ATTRIBUTE_KEY))
              throw new Error("Shopify did not clear the old report binding. No checkout started.");
            verifiedLive = confirmed;
          }
          const byVariant = new Map(verifiedLive.lines.map((l) => [l.variantId, l]));
          set({
            checkoutUrl: verifiedLive.checkoutUrl,
            items: get().items
              .filter((i) => byVariant.has(i.variantId))
              .map((i) => {
                const l = byVariant.get(i.variantId)!;
                return { ...i, lineId: l.lineId, quantity: l.quantity, price: l.price };
              }),
          });
          return verifiedLive.checkoutUrl;
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
      partialize: (s) => ({ items: s.items, cartId: s.cartId, checkoutUrl: s.checkoutUrl }),
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
