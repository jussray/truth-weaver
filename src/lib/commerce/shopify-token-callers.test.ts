import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRUTH_WEAVER_SHOPIFY_DOMAIN } from "./shopify-order-proof";
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), from: vi.fn(), getUser: vi.fn() }));
vi.mock("./shopify-admin-token.server", () => ({ getTruthWeaverShopifyAdminToken: mocks.resolve }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from, auth: { getUser: mocks.getUser } } }));
// Exercise the unchanged real handler, without the framework route wrapper.
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
import { Route } from "../../routes/api/public/shopify/orders-paid";
import { verifyFreshTruthWeaverPurchase } from "./shopify-order.server";
import { reconcileOwnSnapshotPurchases } from "./snapshot-reconciliation.server";
import { adminGraphql } from "../merchant/admin.server";
const post = (Route as unknown as { server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
beforeEach(() => { vi.clearAllMocks(); mocks.resolve.mockResolvedValue(null); vi.stubEnv("SHOPIFY_WEBHOOK_SECRET", "fixture-hmac"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function request(signed = true) {
  const body = JSON.stringify({ admin_graphql_api_id: "gid://shopify/Order/123", customer: { admin_graphql_api_id: "gid://shopify/Customer/9" } });
  return new Request("https://truthweaver.jussco.company/api/public/shopify/orders-paid", { method: "POST", body,
    headers: { "x-shopify-shop-domain": TRUTH_WEAVER_SHOPIFY_DOMAIN, "x-shopify-topic": "orders/paid",
      "x-shopify-hmac-sha256": createHmac("sha256", signed ? "fixture-hmac" : "wrong").update(body).digest("base64") } });
}
describe("token caller negative paths: fixtures are not payment proof", () => {
  it("signed webhook without Admin token records nothing", async () => {
    const response = await post({ request: request() }); expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ recorded: false, reason: "not_verifiable" });
    expect(mocks.resolve).toHaveBeenCalledWith(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("missing HMAC secret remains 503 before token/storage access", async () => {
    vi.stubEnv("SHOPIFY_WEBHOOK_SECRET", ""); const response = await post({ request: request() });
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ recorded: false, reason: "secret_missing" });
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("bad HMAC remains 401 before token/storage access", async () => {
    const response = await post({ request: request(false) }); expect(response.status).toBe(401);
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("purchase proof denies missing token without a Shopify request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await verifyFreshTruthWeaverPurchase("gid://shopify/Order/123", "snapshot", "gid://shopify/Customer/9"))
      .toEqual({ granted: false, reason: "missing_proof" });
    expect(mocks.resolve).toHaveBeenCalledWith(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("merchant stays unavailable without a token", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(adminGraphql("{ shop { id } }")).rejects.toThrow("Shopify Admin is not connected.");
    expect(mocks.resolve).toHaveBeenCalledWith({ allowMerchantLegacy: true }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("invalid session cannot resolve tokens or touch records", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    expect(await reconcileOwnSnapshotPurchases("fixture-invalid-session")).toEqual({ state: "not_authenticated", recorded: 0, reportReady: false });
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("owned binding with missing token remains unavailable", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "fixture-user" } }, error: null });
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { shopify_customer_gid: "gid://shopify/Customer/9" }, error: null }) });
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await reconcileOwnSnapshotPurchases("fixture-session")).toEqual({ state: "unavailable", recorded: 0, reportReady: false });
    expect(mocks.resolve).toHaveBeenCalledWith(); expect(fetcher).not.toHaveBeenCalled(); expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});