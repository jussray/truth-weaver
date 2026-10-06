import { describe, expect, it } from "vitest";

import {
  historicalVersionRequired,
  resolveJurisdictionHint,
  sourceRegistryForUrl,
  type LegalNavigatorInput,
} from "./legal-navigator";

describe("Truth Weaver jurisdiction resolver", () => {
  it("fails closed for a continent-only location", () => {
    const result = resolveJurisdictionHint("Africa");
    expect(result.status).toBe("JURISDICTION UNKNOWN");
    expect(result.allowedDomains).toEqual([]);
    expect(result.missing.join(" ")).toMatch(/country/i);
  });

  it("resolves Philadelphia through federal, state, and municipal layers", () => {
    const result = resolveJurisdictionHint("Philadelphia, Pennsylvania");
    expect(result.status).toBe("RESOLVED");
    expect(result.layers).toEqual([
      "United States (Federal)",
      "Pennsylvania",
      "Philadelphia",
    ]);
    expect(result.allowedDomains).toContain("uscode.house.gov");
    expect(result.allowedDomains).toContain("legis.state.pa.us");
    expect(result.allowedDomains).toContain("phila.gov");
  });

  it("keeps Nigeria partial when state-level law may matter", () => {
    const result = resolveJurisdictionHint("Nigeria");
    expect(result.status).toBe("PARTIAL");
    expect(result.layers).toEqual(["Nigeria"]);
    expect(result.missing.join(" ")).toMatch(/state/i);
  });

  it("recognizes registered official source domains but not lookalikes", () => {
    expect(sourceRegistryForUrl("https://www.legis.state.pa.us/example")?.jurisdiction).toBe(
      "Pennsylvania",
    );
    expect(sourceRegistryForUrl("https://legis.state.pa.us.example.com/fake")).toBeNull();
  });

  it("requires historical-version verification for older events", () => {
    const input: LegalNavigatorInput = {
      question: "What law applied?",
      place: "Pennsylvania",
      eventDate: "2020-01-01",
      asOfDate: "",
      facts: "",
      predecessorFingerprint: "",
    };
    expect(historicalVersionRequired(input, new Date("2026-10-06T00:00:00Z"))).toBe(true);
  });
});
