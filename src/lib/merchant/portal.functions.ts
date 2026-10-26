import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ORDER_GID,
  PRODUCT_GID,
  VARIANT_GID,
  confirmationPhrase,
  priceChangeMessage,
  redactOrder,
  requiresTypedConfirmation,
  validatePrice,
} from "./policy";

/* Every handler re-checks the merchant role server-side. The route guard is UX only. */

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

/** Matches the public.merchant_audit_log.outcome database CHECK constraint. */
type MerchantAuditOutcome = "attempted" | "succeeded" | "failed" | "denied";

async function assertMerchant({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "merchant" });
  if (error || data !== true) throw new Error("Merchant authorization required.");
}

async function audit(
  { supabase, userId }: Ctx,
  row: { action: string; target: string; before_state?: Json; requested_state?: Json; outcome: MerchantAuditOutcome; detail?: string },
) {
  const { error } = await supabase.from("merchant_audit_log").insert({ actor_id: userId, ...row });
  if (error) throw new Error("Audit log write failed.");
}

async function admin() {
  return import("./admin.server");
}

function storeError(e: unknown) {
  if (e instanceof Error && e.name !== "Error") return e.message;
  if (e instanceof Error && /store connection|not connected/i.test(e.message)) return e.message;
  return "Shopify is unavailable right now. Nothing was changed.";
}

export const getMerchantAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "merchant" });
    return { isMerchant: data === true };
  });

export type MerchantVariant = { id: string; title: string; sku: string | null; price: string };
export type MerchantProduct = { id: string; title: string; status: string; variants: MerchantVariant[] };

export const listMerchantProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ products: MerchantProduct[]; error: string | null }> => {
    await assertMerchant(context as Ctx);
    try {
      const { adminGraphql } = await admin();
      const data = await adminGraphql<{ products: { nodes: Array<{ id: string; title: string; status: string; variants: { nodes: MerchantVariant[] } }> } }>(
        `{ products(first: 50) { nodes { id title status variants(first: 20) { nodes { id title sku price } } } } }`,
      );
      return {
        products: data.products.nodes.map((p) => ({ id: p.id, title: p.title, status: p.status, variants: p.variants.nodes })),
        error: null,
      };
    } catch (e) {
      return { products: [], error: storeError(e) };
    }
  });

export const updateVariantPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      productId: z.string().regex(PRODUCT_GID),
      variantId: z.string().regex(VARIANT_GID),
      price: z.string(),
      confirmation: z.string().max(80).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertMerchant(ctx);
    const price = validatePrice(data.price);
    if (!price) return { ok: false as const, message: "Enter a price like 12.00 between 0.50 and 10000.00." };

    const { adminGraphql } = await admin();
    let before: { price: string; title: string; product: { title: string } };
    try {
      const read = await adminGraphql<{ productVariant: typeof before | null }>(
        `query($id: ID!) { productVariant(id: $id) { price title product { title } } }`,
        { id: data.variantId },
      );
      if (!read.productVariant) return { ok: false as const, message: "That product option no longer exists." };
      before = read.productVariant;
    } catch (e) {
      return { ok: false as const, message: storeError(e) };
    }

    const target = data.variantId;
    if (requiresTypedConfirmation(before.price, price) && data.confirmation !== confirmationPhrase("price", target, price)) {
      await audit(ctx, { action: "price.update", target, before_state: { price: before.price }, requested_state: { price }, outcome: "denied", detail: "typed confirmation missing or mismatched" });
      return { ok: false as const, message: "This is a large change. Type the confirmation phrase exactly to continue." };
    }

    await audit(ctx, { action: "price.update", target, before_state: { price: before.price }, requested_state: { price }, outcome: "attempted" });
    let writeAttempted = false;
    let catalogReadbackConfirmed = false;
    try {
      // The request may reach Shopify even if the response is lost. Treat any
      // unconfirmed write attempt as potentially applied; never claim no change.
      writeAttempted = true;
      const res = await adminGraphql<{ productVariantsBulkUpdate: { productVariants: Array<{ id: string; price: string }> | null; userErrors: Array<{ message: string }> } }>(
        `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price } userErrors { message } }
        }`,
        { productId: data.productId, variants: [{ id: data.variantId, price }] },
      );
      const result = res.productVariantsBulkUpdate;
      const after = result.productVariants?.[0]?.price;
      if (result.userErrors.length || after !== price) {
        throw new Error(result.userErrors[0]?.message ?? "Shopify did not confirm the new price.");
      }
      // A successful mutation response alone is insufficient: independently
      // confirm the live catalog before writing a "succeeded" audit record.
      const readback = await adminGraphql<{ productVariant: { price: string } | null }>(
        `query($id: ID!) { productVariant(id: $id) { price } }`,
        { id: data.variantId },
      );
      if (readback.productVariant?.price !== price) {
        throw new Error("Independent catalog price readback did not match the requested price.");
      }
      catalogReadbackConfirmed = true;
      await audit(ctx, { action: "price.update", target, before_state: { price: before.price }, requested_state: { price }, outcome: "succeeded" });
      const label = `${before.product.title} — ${before.title}`;
      return { ok: true as const, before: before.price, after, message: priceChangeMessage(label, before.price, after) };
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown";
      // "unverified" is not a permitted database outcome. Store it in detail,
      // preserving the exact four allowed outcomes without a risky migration.
      const detail = `${writeAttempted ? "UNVERIFIED_SHOPIFY_WRITE: " : ""}${reason}`.slice(0, 200);
      try {
        await audit(ctx, { action: "price.update", target, before_state: { price: before.price }, requested_state: { price }, outcome: "failed", detail });
      } catch {
        return {
          ok: false as const,
          message: writeAttempted
            ? "A Shopify price write may have occurred, and the audit receipt could not be saved. Check Shopify Admin before retrying."
            : "Audit logging is unavailable. No price change was attempted.",
        };
      }
      return {
        ok: false as const,
        message: catalogReadbackConfirmed
          ? "Shopify confirmed the catalog price, but the final audit receipt could not be saved. Check Shopify Admin and the activity log before retrying."
          : writeAttempted
            ? "A Shopify price write was attempted, but the live price was not verified. It may have changed; check Shopify Admin before retrying."
            : storeError(e),
      };
    }
  });

export const listMerchantOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMerchant(context as Ctx);
    try {
      const { adminGraphql } = await admin();
      const data = await adminGraphql<{ orders: { nodes: Array<Parameters<typeof redactOrder>[0] & { lineItems: { nodes: Array<{ title: string; quantity: number }> } }> } }>(
        `{ orders(first: 50, sortKey: CREATED_AT, reverse: true) { nodes {
          id name createdAt displayFinancialStatus displayFulfillmentStatus test
          totalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 10) { nodes { title quantity } } } } }`,
      );
      return { orders: data.orders.nodes.map((o) => ({ ...redactOrder(o), items: o.lineItems.nodes })), error: null as string | null };
    } catch (e) {
      return { orders: [], error: storeError(e) };
    }
  });

/** Admin-only, audited reveal of customer contact details for one order. */
export const revealOrderCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderId: z.string().regex(ORDER_GID), reason: z.string().trim().min(5).max(200) }).parse)
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertMerchant(ctx);
    await audit(ctx, { action: "order.reveal_customer", target: data.orderId, requested_state: { reason: data.reason }, outcome: "attempted" });
    try {
      const { adminGraphql } = await admin();
      const r = await adminGraphql<{ order: { email: string | null; customer: { displayName: string } | null; shippingAddress: { city: string | null; provinceCode: string | null; countryCodeV2: string | null } | null } | null }>(
        `query($id: ID!) { order(id: $id) { email customer { displayName } shippingAddress { city provinceCode countryCodeV2 } } }`,
        { id: data.orderId },
      );
      await audit(ctx, { action: "order.reveal_customer", target: data.orderId, requested_state: { reason: data.reason }, outcome: "succeeded" });
      return { ok: true as const, customer: r.order };
    } catch (e) {
      await audit(ctx, { action: "order.reveal_customer", target: data.orderId, outcome: "failed" });
      return { ok: false as const, message: storeError(e) };
    }
  });

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMerchant(context as Ctx);
    const { data, error } = await context.supabase
      .from("merchant_audit_log")
      .select("id, action, target, before_state, requested_state, outcome, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not read the activity log.");
    return data ?? [];
  });

export const createVendorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ label: z.string().trim().min(2).max(120) }).parse)
  .handler(async ({ data, context }) => {
    await assertMerchant(context as Ctx);
    const { data: code, error } = await context.supabase.rpc("create_merchant_invite", { _label: data.label });
    if (error) throw new Error("Could not create the invite.");
    return { code: code as string };
  });

export const redeemVendorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ code: z.string().trim().regex(/^[0-9a-f]{36}$/) }).parse)
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("redeem_merchant_invite", { _code: data.code });
    return { ok: !error && ok === true };
  });
