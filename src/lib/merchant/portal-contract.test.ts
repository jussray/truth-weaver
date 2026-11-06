import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  graphql: vi.fn(),
  auditInsert: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { getUser: mocks.getUser }, from: mocks.from },
}));
vi.mock("./admin.server", () => ({ adminGraphql: mocks.graphql }));

import {
  readMerchantDashboard, updateMerchantProductStatus, updateMerchantVariantPrice,
} from "./portal.server";
import { confirmationPhrase } from "./policy";

const userId = "11111111-1111-4111-8111-111111111111";
const productId = "gid://shopify/Product/123";
const variantId = "gid://shopify/ProductVariant/456";

function merchantSession(allowed = true) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  const roles = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: allowed ? { role: "merchant" } : null,
      error: null,
    }),
  };
  mocks.auditInsert.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) =>
    table === "user_roles" ? roles : { insert: mocks.auditInsert });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Truth Weaver merchant isolation", () => {
  it("refuses an invalid Supabase session before Shopify calls", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Invalid" } });
    await expect(readMerchantDashboard("invalid")).rejects.toThrow("Merchant authorization required");
    expect(mocks.graphql).not.toHaveBeenCalled();
  });

  it("refuses a signed-in non-merchant before Shopify calls", async () => {
    merchantSession(false);
    await expect(readMerchantDashboard("valid-token")).rejects.toThrow("Merchant authorization required");
    expect(mocks.graphql).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("requires a confirmation tied to the exact product and value", async () => {
    merchantSession();
    await expect(updateMerchantProductStatus("valid", productId, "ARCHIVED", "STATUS 999 ARCHIVED", "DRAFT"))
      .rejects.toThrow("Exact product-status confirmation");
    expect(mocks.graphql).not.toHaveBeenCalled();
  });

  it("cannot publish a draft Snapshot even when the caller has merchant role", async () => {
    merchantSession();
    mocks.graphql.mockResolvedValueOnce({ product: {
      id: productId, title: "Notice Snapshot", status: "DRAFT",
      variants: { pageInfo: { hasNextPage: false }, nodes: [
        { id: variantId, sku: "TW-SNAPSHOT-ONE", price: "10.00" },
      ] },
    } });
    await expect(updateMerchantProductStatus(
      "valid", productId, "ACTIVE", confirmationPhrase("status", productId, "ACTIVE"),
      "DRAFT",
    )).rejects.toThrow("launch hold");
    expect(mocks.graphql).toHaveBeenCalledTimes(1);
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("fails closed if SKU coverage cannot be fully enumerated", async () => {
    merchantSession();
    mocks.graphql.mockResolvedValueOnce({ product: {
      id: productId, title: "Many variants", status: "DRAFT",
      variants: { pageInfo: { hasNextPage: true }, nodes: [] },
    } });
    await expect(updateMerchantProductStatus(
      "valid", productId, "ACTIVE", confirmationPhrase("status", productId, "ACTIVE"),
      "DRAFT",
    )).rejects.toThrow("could not be verified");
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("rejects price changes when the variant belongs to another product", async () => {
    merchantSession();
    mocks.graphql.mockResolvedValueOnce({ productVariant: {
      id: variantId, sku: "OTHER", price: "20.00",
      product: { id: "gid://shopify/Product/999" },
    } });
    await expect(updateMerchantVariantPrice(
      "valid", productId, variantId, "22.00",
      confirmationPhrase("price", variantId, "22.00"), "20.00",
    )).rejects.toThrow("does not belong");
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("requires an audit attempt, Shopify mutation, fresh readback, and success receipt", async () => {
    merchantSession();
    mocks.graphql.mockResolvedValueOnce({ productVariant: {
      id: variantId, sku: "OTHER", price: "20.00", product: { id: productId },
    } }).mockResolvedValueOnce({ productVariantsBulkUpdate: {
      productVariants: [{ id: variantId, price: "22.00" }], userErrors: [],
    } }).mockResolvedValueOnce({ productVariant: {
      id: variantId, sku: "OTHER", price: "22.00", product: { id: productId },
    } });
    const result = await updateMerchantVariantPrice(
      "valid", productId, variantId, "22.00",
      confirmationPhrase("price", variantId, "22.00"), "20.00",
    );
    expect(result).toEqual({ verified: true, unchanged: false, price: "22.00" });
    expect(mocks.graphql).toHaveBeenCalledTimes(3);
    expect(mocks.graphql.mock.calls[1]?.[0]).toContain("productVariantsBulkUpdate");
    expect(mocks.auditInsert).toHaveBeenCalledTimes(2);
    expect(mocks.auditInsert.mock.calls[0]?.[0]?.outcome).toBe("attempted");
    expect(mocks.auditInsert.mock.calls[1]?.[0]?.outcome).toBe("succeeded");
  });

  it("blocks stale Shopify status overwrite before audit or mutation", async () => {
    merchantSession();
    mocks.graphql.mockResolvedValueOnce({ product: {
      id: productId, title: "Ordinary product", status: "ARCHIVED",
      variants: { pageInfo: { hasNextPage: false }, nodes: [{ id: variantId, sku: "OTHER", price: "20.00" }] },
    } });
    await expect(updateMerchantProductStatus(
      "valid", productId, "ACTIVE", confirmationPhrase("status", productId, "ACTIVE"), "DRAFT",
    )).rejects.toThrow("Shopify status changed");
    expect(mocks.graphql).toHaveBeenCalledTimes(1);
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("blocks stale Shopify price overwrite before audit or mutation", async () => {
    merchantSession();
    mocks.graphql.mockResolvedValueOnce({ productVariant: {
      id: variantId, sku: "OTHER", price: "21.00", product: { id: productId },
    } });
    await expect(updateMerchantVariantPrice(
      "valid", productId, variantId, "22.00",
      confirmationPhrase("price", variantId, "22.00"), "20.00",
    )).rejects.toThrow("Shopify price changed");
    expect(mocks.graphql).toHaveBeenCalledTimes(1);
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("does not equate an order permission error with no orders", async () => {
    merchantSession();
    mocks.graphql.mockResolvedValueOnce({ products: { pageInfo: { hasNextPage: false }, nodes: [] } })
      .mockRejectedValueOnce(new Error("read_orders scope missing"));
    const result = await readMerchantDashboard("valid");
    expect(result.ordersUnavailable).toBe(true);
    expect(result.orders).toEqual([]);
  });
  it("blocks price mutations if the attempted audit receipt cannot be stored", async () => {
    merchantSession();
    mocks.graphql.mockResolvedValueOnce({ productVariant: {
      id: variantId, sku: "OTHER", price: "20.00", product: { id: productId },
    } });
    mocks.auditInsert.mockResolvedValueOnce({ error: { message: "permission denied" } });
    await expect(updateMerchantVariantPrice(
      "valid", productId, variantId, "22.00",
      confirmationPhrase("price", variantId, "22.00"), "20.00",
    )).rejects.toThrow("Merchant audit receipt unavailable");
    expect(mocks.graphql).toHaveBeenCalledTimes(1);
    expect(mocks.auditInsert).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing products page on the hardened merchant write path", () => {
    const page = readFileSync(resolve(process.cwd(), "src/routes/merchant.products.tsx"), "utf8");
    const handlers = readFileSync(resolve(process.cwd(), "src/lib/merchant/portal.functions.ts"), "utf8");
    expect(page).toContain("changeMerchantVariantPrice");
    expect(page).toContain("expectedCurrentPrice: pending.variant.price");
    expect(page).toContain("typed !== phrase");
    expect(handlers).not.toContain("export const updateVariantPrice");
  });

  it("requires the reviewed audit migration to disable browser-generated success receipts", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20261014151500_tw_merchant_audit_server_only.sql"),
      "utf8",
    );
    expect(sql).toContain('DROP POLICY IF EXISTS "merchants append own audit"');
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.merchant_audit_log FROM PUBLIC, anon, authenticated/i);
    expect(sql).toContain("GRANT ALL ON public.merchant_audit_log TO service_role");
    expect(sql).toContain("_user_id = auth.uid()");
  });

});
