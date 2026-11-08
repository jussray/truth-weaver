import { NOTICE_OFFERS, isNoticeOfferSellable, type NoticeOffer } from "../notice-offers";
import { NOTICE_VARIANTS } from "./shopify-order-proof";

/**
 * Client-side safety interlock, not a substitute for Shopify publication controls.
 * Known Notice variants require a deliberate release decision and every fulfillment
 * gate. A Shopify "active" status or Storefront publication never grants release.
 */
export function isStorefrontVariantSellable(
  variantId: string,
  tags: readonly string[] = [],
): boolean {
  if (tags.some((tag) => tag.trim().toLowerCase() === "launch-hold")) return false;

  const notice = (Object.keys(NOTICE_VARIANTS) as NoticeOffer[])
    .find((offer) => NOTICE_VARIANTS[offer] === variantId);
  if (!notice) return true;

  return NOTICE_OFFERS[notice].readyForSale && isNoticeOfferSellable(notice, []);
}
