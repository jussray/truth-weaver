import { expect, test } from "@playwright/test";

test("Lovable OAuth callback fails closed without a code or state", async ({ request }) => {
  const response = await request.get("/auth/lovable/callback", { maxRedirects: 0 });
  expect(response.status()).toBe(400);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(await response.json()).toEqual({ ok: false, reason: "invalid_request" });
});

test("Lovable OAuth callback with code and state reports not_configured and no session", async ({ request }) => {
  const response = await request.get("/auth/lovable/callback?code=e2e-code&state=e2e-state", { maxRedirects: 0 });
  expect(response.status()).toBe(503);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect(await response.json()).toEqual({ ok: false, reason: "not_configured" });
});
