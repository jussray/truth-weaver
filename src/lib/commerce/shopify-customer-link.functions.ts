import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* Neither handler accepts a Supabase user ID, Shopify customer ID, payment
 * status or entitlement from the browser. Identity comes from both providers.
 */
export const connectShopifyCustomer = createServerFn({ method: "POST" })
  .validator(z.object({
    supabaseAccessToken: z.string().min(1).max(8192),
    authorizationCode: z.string().min(1).max(2048),
    codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
    redirectUri: z.literal("https://www.truthweaver.jussco.company/account"),
  }))
  .handler(async ({ data }) => {
    const { linkShopifyCustomerAccount } = await import("./shopify-customer-link.server");
    return linkShopifyCustomerAccount(data);
  });

export const customerLinkStatus = createServerFn({ method: "POST" })
  .validator(z.object({ authAccessToken: z.string().min(1).max(8192) }))
  .handler(async ({ data }) => {
    const { getShopifyLinkStatus } = await import("./shopify-customer-link.server");
    return { linked: await getShopifyLinkStatus(data.authAccessToken) };
  });
