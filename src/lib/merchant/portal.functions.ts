import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Browser supplies its Supabase access token only. Server independently
 * validates the session and the owner-assigned merchant role on every action.
 */
const auth = z.object({ authAccessToken: z.string().min(1).max(8192) });
const productGid = z.string().regex(/^gid:\/\/shopify\/Product\/[1-9][0-9]*$/);
const variantGid = z.string().regex(/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/);

export const readMerchantDashboard = createServerFn({ method: "POST" })
  .validator(auth)
  .handler(async ({ data }) => {
    const { readMerchantDashboard } = await import("./portal.server");
    return readMerchantDashboard(data.authAccessToken);
  });

export const changeMerchantProductStatus = createServerFn({ method: "POST" })
  .validator(auth.extend({
    productId: productGid,
    nextStatus: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
    confirmation: z.string().min(1).max(128),
  }))
  .handler(async ({ data }) => {
    const { updateMerchantProductStatus } = await import("./portal.server");
    return updateMerchantProductStatus(
      data.authAccessToken, data.productId, data.nextStatus, data.confirmation,
    );
  });

export const changeMerchantVariantPrice = createServerFn({ method: "POST" })
  .validator(auth.extend({
    productId: productGid,
    variantId: variantGid,
    price: z.string().regex(/^(?:0|[1-9][0-9]{0,5})\.[0-9]{2}$/),
    confirmation: z.string().min(1).max(128),
  }))
  .handler(async ({ data }) => {
    const { updateMerchantVariantPrice } = await import("./portal.server");
    return updateMerchantVariantPrice(
      data.authAccessToken, data.productId, data.variantId, data.price, data.confirmation,
    );
  });
