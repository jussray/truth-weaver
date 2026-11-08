import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configure = () => { vi.stubEnv("SHOPIFY_CLIENT_ID", "fixture-client"); vi.stubEnv("SHOPIFY_CLIENT_SECRET", "fixture-secret"); };
const response = (token = "fixture-token", expires: unknown = 86399) => new Response(JSON.stringify({ access_token: token, expires_in: expires }));
const load = async () => (await import("./shopify-admin-token.server")).getTruthWeaverShopifyAdminToken;
beforeEach(() => {
  vi.resetModules();
  for (const key of ["SHOPIFY_ADMIN_ACCESS_TOKEN", "SHOPIFY_ACCESS_TOKEN", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"]) vi.stubEnv(key, "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("bounded server-only Shopify token resolver", () => {
  it("preserves static Admin token without networking", async () => {
    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "fixture-static"); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await (await load())()).toBe("fixture-static"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a static Admin token in strict custom-app mode without credentials", async () => {
    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "fixture-static");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const resolve = await load();
    expect(await resolve({ requireClientCredentials: true })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses a fresh client-credentials token instead of a static Admin token for strict reports", async () => {
    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "fixture-static");
    vi.stubEnv("SHOPIFY_ACCESS_TOKEN", "fixture-connector");
    configure();
    const fetcher = vi.fn().mockResolvedValue(response("fixture-oauth"));
    vi.stubGlobal("fetch", fetcher);
    const resolve = await load();
    expect(await resolve({ requireClientCredentials: true, allowMerchantLegacy: true })).toBe("fixture-oauth");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps legacy connector fallback merchant-only", async () => {
    vi.stubEnv("SHOPIFY_ACCESS_TOKEN", "fixture-connector"); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const resolve = await load(); expect(await resolve()).toBeNull();
    expect(await resolve({ allowMerchantLegacy: true })).toBe("fixture-connector"); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([["", ""], ["fixture-client", ""], ["", "fixture-secret"]])("denies missing/partial config %#", async (id, secret) => {
    vi.stubEnv("SHOPIFY_CLIENT_ID", id); vi.stubEnv("SHOPIFY_CLIENT_SECRET", secret);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await (await load())()).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("posts form credentials only to the pinned shop and reuses a 24h token", async () => {
    configure(); const fetcher = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", fetcher);
    const resolve = await load(); expect(await resolve()).toBe("fixture-token"); expect(await resolve()).toBe("fixture-token");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://fcr-truth-weaver-esimv-203acj81.myshopify.com/admin/oauth/access_token");
    expect(init).toMatchObject({ method: "POST", redirect: "error", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.fromEntries(init.body)).toEqual({ grant_type: "client_credentials", client_id: "fixture-client", client_secret: "fixture-secret" });
  });
  it("renews at five-minute skew and denies failed renewal instead of serving expired tokens", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); configure();
    const fetcher = vi.fn().mockResolvedValueOnce(response("first")).mockResolvedValueOnce(response("second"))
      .mockResolvedValue(new Response("denied", { status: 401 })); vi.stubGlobal("fetch", fetcher);
    const resolve = await load(); expect(await resolve()).toBe("first");
    vi.setSystemTime(86098 * 1000); expect(await resolve()).toBe("first");
    vi.setSystemTime(86099 * 1000); expect(await resolve()).toBe("second");
    vi.setSystemTime(172198 * 1000); expect(await resolve()).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("deduplicates concurrent calls", async () => {
    configure(); const fetcher = vi.fn().mockImplementation(async () => response()); vi.stubGlobal("fetch", fetcher);
    const resolve = await load(); expect(await Promise.all([resolve(), resolve(), resolve()])).toEqual(["fixture-token", "fixture-token", "fixture-token"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 429, 500])("denies HTTP %s without caching", async status => {
    configure(); const fetcher = vi.fn().mockImplementation(async () => new Response("fixture-secret", { status })); vi.stubGlobal("fetch", fetcher);
    const resolve = await load(); expect(await resolve()).toBeNull(); expect(await resolve()).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([null, "86399", 0, 300, -1, 86401, 86399.5])("rejects malformed or unbounded expiry %s", async expiry => {
    configure(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("fixture-token", expiry))); expect(await (await load())()).toBeNull();
  });
  it.each([{}, { access_token: "", expires_in: 86399 }, { access_token: "bad\nheader", expires_in: 86399 },
    { access_token: "fixture-token", expires_in: 86399, error: "not_installed" },
    { access_token: "fixture-token", expires_in: 86399, errors: [] }])("denies response errors %#", async body => {
    configure(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body)))); expect(await (await load())()).toBeNull();
  });
  it("denies malformed JSON/network/timeout without logging secrets", async () => {
    configure(); const log = vi.spyOn(console, "log"); const error = vi.spyOn(console, "error"); const warn = vi.spyOn(console, "warn");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("fixture-secret not-json"))
      .mockRejectedValueOnce(new Error("fixture-secret fixture-token"))
      .mockRejectedValueOnce(new DOMException("fixture-secret", "TimeoutError")));
    const resolve = await load(); expect(await resolve()).toBeNull(); expect(await resolve()).toBeNull(); expect(await resolve()).toBeNull();
    expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled();
  });
  it("invalidates cached credentials after rotation or removal", async () => {
    configure(); const fetcher = vi.fn().mockImplementation(async () => response()); vi.stubGlobal("fetch", fetcher);
    const resolve = await load(); expect(await resolve()).toBe("fixture-token");
    vi.stubEnv("SHOPIFY_CLIENT_SECRET", "changed-fixture"); expect(await resolve()).toBe("fixture-token"); expect(fetcher).toHaveBeenCalledTimes(2);
    vi.stubEnv("SHOPIFY_CLIENT_SECRET", ""); expect(await resolve()).toBeNull();
  });
  it("denies an exchange expired during the request", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); configure();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => { vi.setSystemTime(86099 * 1000); return response(); }));
    expect(await (await load())()).toBeNull();
  });
});