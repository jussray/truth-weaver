import { describe, expect, it } from "vitest";
import { handleLovableOauthCallback } from "./lovable-oauth-callback";

const BASE = "https://www.truthweaver.jussco.company/auth/lovable/callback";

const get = (query = "") => new Request(`${BASE}${query}`, { method: "GET" });

describe("Lovable OAuth callback (fail-closed stub)", () => {
  it("rejects non-GET methods with 405 and Allow: GET", async () => {
    const res = handleLovableOauthCallback(new Request(BASE, { method: "POST" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
    expect(await res.json()).toEqual({ ok: false, reason: "method_not_allowed" });
  });

  it("returns 400 invalid_request when code or state is missing", async () => {
    for (const query of ["", "?code=abc", "?state=xyz", "?code=&state=xyz"]) {
      const res = handleLovableOauthCallback(get(query));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, reason: "invalid_request" });
    }
  });

  it("returns 400 provider_error and never echoes the provider error value", async () => {
    const res = handleLovableOauthCallback(get("?error=access_denied%3Csecret%3E&state=xyz"));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, reason: "provider_error" });
    expect(text).not.toContain("secret");
  });

  it("fails closed with 503 not_configured when code and state are present", async () => {
    const res = handleLovableOauthCallback(get("?code=auth-code-value&state=state-value"));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, reason: "not_configured" });
    expect(text).not.toContain("auth-code-value");
    expect(text).not.toContain("state-value");
  });

  it("sets no-store and no-referrer on every response", () => {
    for (const req of [
      new Request(BASE, { method: "POST" }),
      get("?code=a&state=b"),
      get("?error=x"),
    ]) {
      const res = handleLovableOauthCallback(req);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    }
  });
});
