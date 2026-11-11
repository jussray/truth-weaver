import { afterEach, describe, expect, it, vi } from "vitest";

import { probeConnectorHealth } from "./health";
import { createProvenance, provenanceKey } from "./provenance";
import { allConnectorEnvNames, CONNECTORS, resolveConnectorStatus } from "./registry";

const byId = (id: string) => CONNECTORS.find((c) => c.id === id)!;
const now = new Date("2026-01-01T00:00:00Z");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provenance", () => {
  it("labels AI output generated and INFERRED without backing", () => {
    const p = createProvenance({ provider: "openai", evidenceType: "primary_law", requestedVerification: "VERIFIED LAW" }, now);
    expect(p.evidenceType).toBe("ai_generated");
    expect(p.verification).toBe("INFERRED");
    expect(p.retrievedAt).toBe(now.toISOString());
  });

  it("AI output backed by primary sources is at most SUPPORTED", () => {
    const p = createProvenance({ provider: "anthropic", evidenceType: "ai_generated", backedBy: ["https://uscode.house.gov/x"] }, now);
    expect(p.verification).toBe("SUPPORTED");
  });

  it("no connector result can become VERIFIED LAW", () => {
    for (const provider of ["web", "shopify", "github", "perplexity", "gemini", "muse", "exa", "notion", "linear", "slack"] as const) {
      const p = createProvenance(
        { provider, evidenceType: "primary_law", sourceUrl: "https://example.gov/a", jurisdiction: "US", requestedVerification: "VERIFIED LAW" },
        now,
      );
      expect(p.verification).not.toBe("VERIFIED LAW");
    }
  });

  it("primary law without jurisdiction fails closed", () => {
    const p = createProvenance({ provider: "web", evidenceType: "primary_law", sourceUrl: "https://example.gov/a" }, now);
    expect(p.verification).toBe("JURISDICTION UNKNOWN");
  });

  it("untraceable results stay UNVERIFIED LAW and bad URLs are rejected", () => {
    const p = createProvenance({ provider: "web", evidenceType: "web_page", sourceUrl: "javascript:alert(1)", requestedVerification: "SUPPORTED" }, now);
    expect(p.sourceUrl).toBeNull();
    expect(p.verification).toBe("UNVERIFIED LAW");
  });

  it("rejects invalid timestamps", () => {
    expect(() => createProvenance({ provider: "web", evidenceType: "web_page", retrievedAt: "nope" })).toThrow();
  });

  it("same source collapses to one key", () => {
    const a = createProvenance({ provider: "web", evidenceType: "web_page", sourceUrl: "https://a.org/x" }, now);
    const b = createProvenance({ provider: "web", evidenceType: "web_page", sourceUrl: "https://a.org/x" }, new Date());
    expect(provenanceKey(a)).toBe(provenanceKey(b));
  });
});

describe("connector status", () => {
  it("unknown environment never reports Connected", () => {
    for (const c of CONNECTORS) expect(resolveConnectorStatus(c, null)).not.toBe("connected");
  });

  it("credential presence alone can never report Connected", () => {
    for (const connector of CONNECTORS) {
      const presence = Object.fromEntries(connector.requiredEnv.map((name) => [name, true]));
      expect(resolveConnectorStatus(connector, presence)).not.toBe("connected");
    }
  });

  it("Lovable-managed connectors cannot self-certify from env or linkage presence", () => {
    for (const id of ["notion", "linear", "slack"] as const) {
      const connector = byId(id);
      expect(connector.authMode).toBe("lovable_app_connector");
      expect(connector.requiredEnv).toEqual([]);
      expect(resolveConnectorStatus(connector, {
        NOTION_API_KEY: true,
        LINEAR_API_KEY: true,
        SLACK_BOT_TOKEN: true,
      })).toBe("needs_setup");
      expect(resolveConnectorStatus(connector, {}, { [id]: true })).toBe("degraded");
      expect(resolveConnectorStatus(connector, {}, { [id]: true })).not.toBe("connected");
    }
  });

  it("loads explicit read-proof credentials for managed connectors without self-certifying them", () => {
    const names = allConnectorEnvNames();
    expect(names).toContain("NOTION_API_KEY");
    expect(names).toContain("LINEAR_API_KEY");
    expect(names).toContain("SLACK_BOT_TOKEN");
    expect(names).toContain("EXA_API_KEY");
    for (const id of ["notion", "linear", "slack"] as const) {
      expect(byId(id).requiredEnv).toEqual([]);
      expect(resolveConnectorStatus(byId(id), Object.fromEntries(names.map((name) => [name, true])))).not.toBe("connected");
    }
  });

  it("custom adapters fail closed until required configuration exists", () => {
    expect(resolveConnectorStatus(byId("muse"), {})).toBe("not_configured");
    expect(resolveConnectorStatus(byId("muse"), { MUSE_ENDPOINT: true })).toBe("needs_setup");
    expect(resolveConnectorStatus(byId("muse"), { MUSE_ENDPOINT: true, MUSE_API_KEY: true })).toBe("degraded");
    expect(resolveConnectorStatus(byId("exa"), {})).toBe("not_configured");
    expect(resolveConnectorStatus(byId("exa"), { EXA_API_KEY: true })).toBe("degraded");
  });

  it("built-in AI is Available without key and remains non-green with configuration only", () => {
    expect(resolveConnectorStatus(byId("openai"), {})).toBe("available");
    expect(resolveConnectorStatus(byId("gemini"), { LOVABLE_API_KEY: true })).toBe("degraded");
    expect(resolveConnectorStatus(byId("web"), null)).toBe("available");
  });

  it("promotes only a successful read-only provider probe to Connected and sanitizes the receipt", async () => {
    const secret = "TEST_SECRET_MARKER_123";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ login: "truth-weaver-test", id: 42, ignored: secret }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const health = await probeConnectorHealth(byId("github"), { GITHUB_API_KEY: secret }, now);
    expect(health.status).toBe("connected");
    expect(health.capability).toBe("identity_read");
    expect(health.lastSuccess).toBe(now.toISOString());
    expect(health.receipt).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(health.scope).toEqual({ login: "truth-weaver-test", id: "42" });
    expect(JSON.stringify(health)).not.toContain(secret);
  });

  it("failed provider probes never promote to Connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 })),
    );

    const health = await probeConnectorHealth(byId("github"), { GITHUB_API_KEY: "TEST_BAD_MARKER" }, now);
    expect(health.status).toBe("error");
    expect(health.lastSuccess).toBeNull();
    expect(health.status).not.toBe("connected");
    expect(JSON.stringify(health)).not.toContain("TEST_BAD_MARKER");
  });

  it("promotes a managed connector only after its explicit read-proof credential succeeds", async () => {
    const secret = "TEST_LINEAR_HEALTH_SECRET";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { viewer: { id: "lin_health_1" } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const health = await probeConnectorHealth(byId("linear"), { LINEAR_API_KEY: secret }, now);
    expect(health.status).toBe("connected");
    expect(health.capability).toBe("identity_read");
    expect(health.scope).toEqual({ viewerId: "lin_health_1" });
    expect(health.lastSuccess).toBe(now.toISOString());
    expect(JSON.stringify(health)).not.toContain(secret);
  });

  it("full custom-adapter configuration stays non-green without a safe probe", async () => {
    const health = await probeConnectorHealth(
      byId("muse"),
      { MUSE_ENDPOINT: "https://example.invalid/muse", MUSE_API_KEY: "TEST_SECRET_MARKER_456" },
      now,
    );
    expect(health.status).toBe("degraded");
    expect(health.lastSuccess).toBeNull();
    expect(JSON.stringify(health)).not.toContain("TEST_SECRET_MARKER_456");
  });

  it("keeps the GitHub legal boundary accurate", () => {
    expect(byId("github").limits).toContain("Code is not governing legal authority.");
    expect(byId("github").limits).not.toContain("Code is never legal evidence.");
  });
});
