import { TRUTH_WEAVER_SHOPIFY_DOMAIN } from "./shopify-order-proof";

/**
 * Pure, fail-closed Shopify webhook gate. A valid signature only proves the
 * message came from Shopify; it never proves payment. Payment is re-checked
 * with a fresh Admin read before any Counsel entitlement is recorded.
 */
export type WebhookGate =
  | { ok: true; orderGid: string; customerGid: string | null }
  | { ok: false; status: 401 | 400 | 503; reason:
      "secret_missing" | "bad_signature" | "wrong_shop" | "wrong_topic" | "bad_payload" };

const enc = new TextEncoder();

function b64ToBytes(value: string): Uint8Array | null {
  try {
    const bin = atob(value);
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  } catch { return null; }
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function verifyShopifyHmac(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || header.length > 128) return false;
  const given = b64ToBytes(header);
  if (!given) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
  return equalBytes(mac, given);
}

export async function gateOrdersPaidWebhook(input: {
  rawBody: string;
  headers: { hmac: string | null; shop: string | null; topic: string | null };
  secret: string | undefined;
}): Promise<WebhookGate> {
  if (!input.secret) return { ok: false, status: 503, reason: "secret_missing" };
  if (!(await verifyShopifyHmac(input.rawBody, input.headers.hmac, input.secret)))
    return { ok: false, status: 401, reason: "bad_signature" };
  if (input.headers.shop !== TRUTH_WEAVER_SHOPIFY_DOMAIN) return { ok: false, status: 401, reason: "wrong_shop" };
  if (input.headers.topic !== "orders/paid") return { ok: false, status: 400, reason: "wrong_topic" };
  let body: { admin_graphql_api_id?: unknown; customer?: { admin_graphql_api_id?: unknown } | null };
  try { body = JSON.parse(input.rawBody); } catch { return { ok: false, status: 400, reason: "bad_payload" }; }
  const orderGid = body.admin_graphql_api_id;
  if (typeof orderGid !== "string" || !/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/.test(orderGid))
    return { ok: false, status: 400, reason: "bad_payload" };
  const c = body.customer?.admin_graphql_api_id;
  const customerGid = typeof c === "string" && /^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(c) ? c : null;
  return { ok: true, orderGid, customerGid };
}
