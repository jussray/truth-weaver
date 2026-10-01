import { describe, expect, it } from "vitest";

import { createProvenance, provenanceKey } from "./provenance";
import { CONNECTORS, resolveConnectorStatus } from "./registry";

const byId = (id: string) => CONNECTORS.find((c) => c.id === id)!;
const now = new Date("2026-01-01T00:00:00Z");

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
    for (const provider of ["web", "shopify", "github", "perplexity", "gemini", "muse"] as const) {
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

  it("Muse is Not configured until endpoint and secret exist", () => {
    expect(resolveConnectorStatus(byId("muse"), {})).toBe("not_configured");
    expect(resolveConnectorStatus(byId("muse"), { MUSE_ENDPOINT: true })).toBe("needs_setup");
    expect(resolveConnectorStatus(byId("muse"), { MUSE_ENDPOINT: true, MUSE_API_KEY: true })).toBe("connected");
  });

  it("linkable connectors need setup without credentials", () => {
    for (const id of ["shopify", "perplexity", "github", "anthropic"]) {
      expect(resolveConnectorStatus(byId(id), {})).toBe("needs_setup");
    }
    expect(resolveConnectorStatus(byId("shopify"), { SHOPIFY_STORE_DOMAIN: true })).toBe("needs_setup");
  });

  it("built-in AI is Available without key and public web always Available", () => {
    expect(resolveConnectorStatus(byId("openai"), {})).toBe("available");
    expect(resolveConnectorStatus(byId("gemini"), { LOVABLE_API_KEY: true })).toBe("connected");
    expect(resolveConnectorStatus(byId("web"), null)).toBe("available");
  });
});
