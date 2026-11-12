import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adminGraphql } from "./admin.server";
import { canSetStatus, confirmationPhrase, PRODUCT_GID, VARIANT_GID, validatePrice, type ProductStatus } from "./policy";

/**
 * Merchant-only server adapter. No Shopify Admin credential enters a client bundle.
 * All reads are bound to the configured Truth Weaver store in admin.server.ts.
 * Writes require a real Supabase session, a database merchant role, an exact
 * per-resource confirmation, a durable attempted audit, and provider readback.
 */
type Merchant = { userId: string };
type Money = { amount: string; currencyCode: string };
export type MerchantProduct = {
  id: string; title: string; status: ProductStatus;
  variants: { nodes: Array<{ id: string; sku: string | null; price: string }> };
};
export type MerchantOrder = {
  id: string; name: string; createdAt: string; test: boolean;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPriceSet: { shopMoney: Money };
};

export async function requireMerchant(token: string): Promise<Merchant> {
  if (!token || token.length > 8192) throw new Error("Merchant authorization required.");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Merchant authorization required.");
  const { data: role, error: roleError } = await supabaseAdmin.from("user_roles")
    .select("role").eq("user_id", data.user.id).eq("role", "merchant").maybeSingle();
  if (roleError || role?.role !== "merchant") throw new Error("Merchant authorization required.");
  return { userId: data.user.id };
}

async function audit(userId: string, action: string, target: string, outcome: "attempted" | "succeeded" | "failed", detail: string) {
  const { error } = await supabaseAdmin.from("merchant_audit_log").insert({
    actor_id: userId, action, target, before_state: null, requested_state: null, outcome, detail,
  });
  if (error) throw new Error("Merchant audit receipt unavailable; no further action permitted.");
}

const CATALOG = "query MerchantCatalog { products(first: 30) { pageInfo { hasNextPage } nodes { id title status variants(first: 10) { nodes { id sku price } } } } }";
const ORDERS = "query MerchantOrders { orders(first: 20, sortKey: CREATED_AT, reverse: true) { pageInfo { hasNextPage } nodes { id name createdAt test displayFinancialStatus displayFulfillmentStatus totalPriceSet { shopMoney { amount currencyCode } } } } }";
const PRODUCT = "query MerchantProduct($id: ID!) { product(id: $id) { id title status variants(first: 100) { pageInfo { hasNextPage } nodes { id sku price } } } }";
const VARIANT = "query MerchantVariant($id: ID!) { productVariant(id: $id) { id sku price product { id } } }";
const STATUS_WRITE = "mutation SetMerchantStatus($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id status } userErrors { field message } } }";
const PRICE_WRITE = "mutation SetMerchantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) { productVariants { id price } userErrors { field message } } }";

type CatalogResponse = { products: { nodes: MerchantProduct[]; pageInfo: { hasNextPage: boolean } } };
type OrdersResponse = { orders: { nodes: MerchantOrder[]; pageInfo: { hasNextPage: boolean } } };
type ProductResponse = { product: (MerchantProduct & { variants: MerchantProduct["variants"] & { pageInfo: { hasNextPage: boolean } } }) | null };
type VariantResponse = { productVariant: { id: string; price: string; sku: string | null; product: { id: string } } | null };
type StatusResponse = { productUpdate: { product: { id: string; status: ProductStatus } | null; userErrors: Array<{ message: string }> } };
type PriceResponse = { productVariantsBulkUpdate: { productVariants: Array<{ id: string; price: string }> | null; userErrors: Array<{ message: string }> } };

export async function readMerchantDashboard(token: string) {
  await requireMerchant(token);
  // No customer names, addresses, email, phone, or order notes are requested.
  const catalog = await adminGraphql<CatalogResponse>(CATALOG);
  let orders: MerchantOrder[] = [];
  let ordersUnavailable = false;
  try {
    const response = await adminGraphql<OrdersResponse>(ORDERS);
    orders = response.orders.nodes;
  } catch {
    ordersUnavailable = true; // Never invent an empty order history on permission errors.
  }
  return {
    products: catalog.products.nodes, productsHasMore: catalog.products.pageInfo.hasNextPage,
    orders, ordersUnavailable,
  };
}

export async function updateMerchantProductStatus(
  token: string, productId: string, nextStatus: ProductStatus, confirmation: string, expectedCurrentStatus: ProductStatus,
) {
  const merchant = await requireMerchant(token);
  if (!PRODUCT_GID.test(productId) || !["ACTIVE", "DRAFT", "ARCHIVED"].includes(nextStatus) ||
      !["ACTIVE", "DRAFT", "ARCHIVED"].includes(expectedCurrentStatus)) {
    throw new Error("Invalid product or status.");
  }
  if (confirmation !== confirmationPhrase("status", productId, nextStatus)) {
    throw new Error("Exact product-status confirmation required.");
  }
  const previous = (await adminGraphql<ProductResponse>(PRODUCT, { id: productId })).product;
  if (!previous || previous.id !== productId || previous.variants.pageInfo.hasNextPage) {
    throw new Error("Full product variants could not be verified; no change permitted.");
  }
  if (previous.status !== expectedCurrentStatus) {
    throw new Error("Shopify status changed since your screen loaded. Refresh before changing it.");
  }
  const decision = canSetStatus(nextStatus, previous.variants.nodes.map(v => v.sku));
  if (!decision.allowed) throw new Error(decision.reason);
  if (previous.status === nextStatus) return { verified: true, unchanged: true, status: nextStatus };
  await audit(merchant.userId, "product_status", productId, "attempted", "Requested status " + nextStatus);
  const changed = await adminGraphql<StatusResponse>(STATUS_WRITE, { product: { id: productId, status: nextStatus } });
  if (changed.productUpdate.userErrors.length || changed.productUpdate.product?.id !== productId) {
    await audit(merchant.userId, "product_status", productId, "failed", "Provider rejected status change.");
    throw new Error("Shopify rejected the status change.");
  }
  const verified = (await adminGraphql<ProductResponse>(PRODUCT, { id: productId })).product;
  if (!verified || verified.status !== nextStatus) {
    throw new Error("Provider status readback not verified. Do not retry automatically.");
  }
  await audit(merchant.userId, "product_status", productId, "succeeded", "Status readback " + nextStatus);
  return { verified: true, unchanged: false, status: nextStatus };
}

export async function updateMerchantVariantPrice(
  token: string, productId: string, variantId: string, price: string, confirmation: string, expectedCurrentPrice: string,
) {
  const merchant = await requireMerchant(token);
  if (!PRODUCT_GID.test(productId) || !VARIANT_GID.test(variantId) || !validatePrice(price)) {
    throw new Error("Invalid variant or price.");
  }
  if (confirmation !== confirmationPhrase("price", variantId, price)) {
    throw new Error("Exact variant-price confirmation required.");
  }
  const previous = (await adminGraphql<VariantResponse>(VARIANT, { id: variantId })).productVariant;
  if (!previous || previous.id !== variantId || previous.product.id !== productId) {
    throw new Error("Variant does not belong to the requested product.");
  }
  if (previous.price !== expectedCurrentPrice) {
    throw new Error("Shopify price changed since your screen loaded. Refresh before changing it.");
  }
  if (previous.price === price) return { verified: true, unchanged: true, price };
  await audit(merchant.userId, "variant_price", variantId, "attempted", "Requested price " + price + " USD");
  const changed = await adminGraphql<PriceResponse>(PRICE_WRITE, {
    productId, variants: [{ id: variantId, price }],
  });
  const payload = changed.productVariantsBulkUpdate;
  if (payload.userErrors.length || !payload.productVariants?.some(v => v.id === variantId)) {
    await audit(merchant.userId, "variant_price", variantId, "failed", "Provider rejected price change.");
    throw new Error("Shopify rejected the price change.");
  }
  const verified = (await adminGraphql<VariantResponse>(VARIANT, { id: variantId })).productVariant;
  if (!verified || verified.product.id !== productId || verified.price !== price) {
    throw new Error("Provider price readback not verified. Do not retry automatically.");
  }
  await audit(merchant.userId, "variant_price", variantId, "succeeded", "Price readback " + price + " USD");
  return { verified: true, unchanged: false, price };
}
