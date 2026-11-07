import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { gateOrdersPaidWebhook } from "./shopify-webhook";
import { TRUTH_WEAVER_SHOPIFY_DOMAIN } from "./shopify-order-proof";

const secret = "test-secret";
const body = JSON.stringify({ admin_graphql_api_id: "gid://shopify/Order/123", customer: { admin_graphql_api_id: "gid://shopify/Customer/9" } });
const sign = (b: string, s = secret) => createHmac("sha256", s).update(b).digest("base64");
const headers = (hmac: string | null) => ({ hmac, shop: TRUTH_WEAVER_SHOPIFY_DOMAIN, topic: "orders/paid" });

describe("orders/paid webhook gate", () => {
  it("fails closed with 503 when the secret is missing", async () => {
    expect(await gateOrdersPaidWebhook({ rawBody: body, headers: headers(sign(body)), secret: undefined }))
      .toEqual({ ok: false, status: 503, reason: "secret_missing" });
  });
  it("rejects a wrong signature", async () => {
    const r = await gateOrdersPaidWebhook({ rawBody: body, headers: headers(sign(body, "other")), secret });
    expect(r).toMatchObject({ ok: false, status: 401, reason: "bad_signature" });
  });
  it("rejects a tampered body", async () => {
    const r = await gateOrdersPaidWebhook({ rawBody: body + " ", headers: headers(sign(body)), secret });
    expect(r).toMatchObject({ ok: false, reason: "bad_signature" });
  });
  it("rejects another shop", async () => {
    const r = await gateOrdersPaidWebhook({ rawBody: body, headers: { ...headers(sign(body)), shop: "evil.myshopify.com" }, secret });
    expect(r).toMatchObject({ ok: false, reason: "wrong_shop" });
  });
  it("accepts a valid signed orders/paid message", async () => {
    expect(await gateOrdersPaidWebhook({ rawBody: body, headers: headers(sign(body)), secret }))
      .toEqual({ ok: true, orderGid: "gid://shopify/Order/123", customerGid: "gid://shopify/Customer/9" });
  });
});
