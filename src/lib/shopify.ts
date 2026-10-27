import { toast } from "sonner";
import { isStorefrontVariantSellable } from "./commerce/storefront-launch-guard";

const SHOPIFY_API_VERSION = "2026-10";
const SHOPIFY_STORE_PERMANENT_DOMAIN = "fcr-truth-weaver-esimv-203acj81.myshopify.com";
const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
// Storefront tokens are publishable (read-only, client-safe).
const SHOPIFY_STOREFRONT_TOKEN = "02c9d88b767991eb1061a795a34a5d65";

export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    handle: string;
    productType?: string;
    tags?: string[];
    priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
    images: { edges: Array<{ node: { url: string; altText: string | null } }> };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: { amount: string; currencyCode: string };
          availableForSale: boolean;
          selectedOptions: Array<{ name: string; value: string }>;
        };
      }>;
    };
    options: Array<{ name: string; values: string[] }>;
  };
}

const PRODUCT_FIELDS = `
  id title description handle productType tags
  priceRange { minVariantPrice { amount currencyCode } }
  images(first: 5) { edges { node { url altText } } }
  variants(first: 10) { edges { node { id title price { amount currencyCode } availableForSale selectedOptions { name value } } } }
  options { name values }
`;

export const PRODUCTS_QUERY = `query GetProducts($first: Int!, $query: String) { products(first: $first, query: $query) { edges { node { ${PRODUCT_FIELDS} } } } }`;
export const PRODUCT_BY_HANDLE_QUERY = `query GetProduct($handle: String!) { product(handle: $handle) { ${PRODUCT_FIELDS} } }`;

export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 402) {
    toast.error("Shopify: Payment required", {
      description: "Shopify API access requires an active Shopify billing plan. Visit https://admin.shopify.com to upgrade.",
    });
    throw new Error("Shopify payment required (402)");
  }
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  if (data.errors) throw new Error(`Error calling Shopify: ${data.errors.map((e: { message: string }) => e.message).join(", ")}`);
  return data;
}

export async function fetchProducts(query?: string): Promise<ShopifyProduct[]> {
  const data = await storefrontApiRequest(PRODUCTS_QUERY, { first: 50, query: query ?? null });
  return data?.data?.products?.edges ?? [];
}

export async function fetchProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
  const node = data?.data?.product;
  return node ? { node } : null;
}

export function formatPrice(p: { amount: string; currencyCode: string }) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: p.currencyCode }).format(parseFloat(p.amount));
}

// ---- Cart API ----
const CART_QUERY = `query cart($id: ID!) { cart(id: $id) { id totalQuantity } }`;
const CART_CREATE_MUTATION = `mutation cartCreate($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } } } userErrors { field message } } }`;
const CART_LINES_ADD_MUTATION = `mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { id lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } } } userErrors { field message } } }`;
const CART_LINES_UPDATE_MUTATION = `mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } userErrors { field message } } }`;
const CART_LINES_REMOVE_MUTATION = `mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { id } userErrors { field message } } }`;

type UserError = { field: string[] | null; message: string };

// Accept only checkout links for THIS Shopify store. A legitimate Shopify
// response must not send a buyer to a different merchant's checkout.
export function formatCheckoutUrl(checkoutUrl: string): string | null {
  try {
    const url = new URL(checkoutUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname !== SHOPIFY_STORE_PERMANENT_DOMAIN) return null;
    if (!/^\/(?:checkouts?\/|cart\/c\/)/.test(url.pathname)) return null;
    // Preserve Shopify's cart token and existing query parameters verbatim.
    return url.toString();
  } catch {
    return null;
  }
}

function isCartNotFoundError(errs: UserError[]) {
  return errs.some((e) => /cart not found|does not exist/i.test(e.message));
}

const CART_FULL_QUERY = `query cart($id: ID!) { cart(id: $id) { id totalQuantity checkoutUrl lines(first: 100) { edges { node { id quantity merchandise { ... on ProductVariant { id price { amount currencyCode } } } } } } } }`;

export type LiveCart = {
  checkoutUrl: string;
  totalQuantity: number;
  lines: { lineId: string; variantId: string; quantity: number; price: { amount: string; currencyCode: string } }[];
} | null;

// null = cart gone/empty. Throws on API failure.
export async function fetchLiveCart(cartId: string): Promise<LiveCart> {
  const data = await storefrontApiRequest(CART_FULL_QUERY, { id: cartId });
  const cart = data?.data?.cart;
  if (!cart || cart.totalQuantity === 0) return null;
  // Restored Shopify carts may predate the launch hold: never return checkout.
  if (cart.lines?.edges?.some((edge: { node: { merchandise: { id: string } } }) =>
    !isStorefrontVariantSellable(edge.node.merchandise.id))) return null;
  const checkoutUrl = formatCheckoutUrl(cart.checkoutUrl);
  if (!checkoutUrl) throw new Error("Unsafe checkout URL from Shopify");
  return {
    checkoutUrl,
    totalQuantity: cart.totalQuantity,
    lines: cart.lines.edges.map((e: { node: { id: string; quantity: number; merchandise: { id: string; price: { amount: string; currencyCode: string } } } }) => ({
      lineId: e.node.id,
      variantId: e.node.merchandise.id,
      quantity: e.node.quantity,
      price: e.node.merchandise.price,
    })),
  };
}

export async function cartExists(cartId: string): Promise<boolean> {
  const data = await storefrontApiRequest(CART_QUERY, { id: cartId });
  const cart = data?.data?.cart;
  return !!cart && cart.totalQuantity > 0;
}

export async function createShopifyCart(variantId: string, quantity: number) {
  if (!isStorefrontVariantSellable(variantId)) return null;
  const data = await storefrontApiRequest(CART_CREATE_MUTATION, { input: { lines: [{ quantity, merchandiseId: variantId }] } });
  const errs: UserError[] = data?.data?.cartCreate?.userErrors ?? [];
  if (errs.length) {
    console.error("Cart creation failed:", errs);
    return null;
  }
  const cart = data?.data?.cartCreate?.cart;
  const lineId = cart?.lines?.edges?.[0]?.node?.id;
  const checkoutUrl = cart?.checkoutUrl ? formatCheckoutUrl(cart.checkoutUrl) : null;
  if (!checkoutUrl || !lineId) return null;
  return { cartId: cart.id as string, checkoutUrl, lineId: lineId as string };
}

export async function addLineToShopifyCart(cartId: string, variantId: string, quantity: number) {
  if (!isStorefrontVariantSellable(variantId)) return { success: false };
  const data = await storefrontApiRequest(CART_LINES_ADD_MUTATION, { cartId, lines: [{ quantity, merchandiseId: variantId }] });
  const errs: UserError[] = data?.data?.cartLinesAdd?.userErrors ?? [];
  if (isCartNotFoundError(errs)) return { success: false, cartNotFound: true };
  if (errs.length) {
    console.error("Add line failed:", errs);
    return { success: false };
  }
  const lines: Array<{ node: { id: string; merchandise: { id: string } } }> = data?.data?.cartLinesAdd?.cart?.lines?.edges ?? [];
  return { success: true, lineId: lines.find((l) => l.node.merchandise.id === variantId)?.node.id };
}

export async function updateShopifyCartLine(cartId: string, lineId: string, quantity: number) {
  const data = await storefrontApiRequest(CART_LINES_UPDATE_MUTATION, { cartId, lines: [{ id: lineId, quantity }] });
  const errs: UserError[] = data?.data?.cartLinesUpdate?.userErrors ?? [];
  if (isCartNotFoundError(errs)) return { success: false, cartNotFound: true };
  if (errs.length) {
    console.error("Update line failed:", errs);
    return { success: false };
  }
  return { success: true };
}

export async function removeLineFromShopifyCart(cartId: string, lineId: string) {
  const data = await storefrontApiRequest(CART_LINES_REMOVE_MUTATION, { cartId, lineIds: [lineId] });
  const errs: UserError[] = data?.data?.cartLinesRemove?.userErrors ?? [];
  if (isCartNotFoundError(errs)) return { success: false, cartNotFound: true };
  if (errs.length) {
    console.error("Remove line failed:", errs);
    return { success: false };
  }
  return { success: true };
}
