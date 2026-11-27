import { describe, expect, it } from "vitest";
import {
  claimReviewInput, parseClaimReview, normalizeSearchConsole, isAllowedOwner,
  type SearchConsoleSnapshot,
} from "./contract";

describe("private owner authorization", () => {
  const owner = "8af263ba-9abc-4f75-87c7-ab7a46b77030";
  it("requires a verified auth user ID in a secure server allowlist", () => {
    expect(isAllowedOwner(owner, owner)).toBe(true);
    expect(isAllowedOwner(owner, "")).toBe(false);
    expect(isAllowedOwner(owner, "someone@example.com")).toBe(false);
    expect(isAllowedOwner(owner, "35c1f495-c2cd-4b88-b55e-e296be291a64")).toBe(false);
  });
});

describe("claim review contract", () => {
  const input = {
    claim: "The published app meets the release gate for this feature.",
    evidence: [{ label: "CI receipt", detail: "The exact commit CI reports eleven completed checks." }],
    consent: true as const,
  };
  it("requires explicit consent, a bounded claim, and at least one evidence item", () => {
    expect(claimReviewInput.safeParse(input).success).toBe(true);
    expect(claimReviewInput.safeParse({ ...input, consent: false }).success).toBe(false);
    expect(claimReviewInput.safeParse({ ...input, evidence: [] }).success).toBe(false);
    expect(claimReviewInput.safeParse({ ...input, claim: "x".repeat(2500) }).success).toBe(false);
    expect(claimReviewInput.safeParse({ ...input, extra: "undocumented" }).success).toBe(false);
  });
  it("only yields advisory findings; never authorizes release", () => {
    const valid = {
      gaps: [{ issue: "No live readback", neededProof: "Dated independent production receipt" }],
      attackQuestions: ["Could the production deployment differ from this exact head?"],
      nextGate: "independent-verification",
      gateReason: "Confirm the deployed SHA and live user journey before a claim.",
    };
    expect(parseClaimReview(JSON.stringify(valid)).nextGate).toBe("independent-verification");
    expect(() => parseClaimReview(JSON.stringify({ ...valid, nextGate: "publish" }))).toThrow();
    expect(() => parseClaimReview(JSON.stringify({ ...valid, verified: true }))).toThrow();
    expect(() => parseClaimReview("not JSON")).toThrow();
  });
});

describe("Google Search Console mapping", () => {
  const site = "https://truthweaver.jussco.company/";
  const sitemap = site + "sitemap.xml";
  it("distinguishes sitemap processing from per-page indexing", () => {
    const r: SearchConsoleSnapshot = normalizeSearchConsole({
      checkedAt: "2026-11-26T19:00:00Z",
      sitemapResponse: { sitemap: [{ path: sitemap, isPending: true, errors: "2", warnings: "0", contents: [{type:"web",submitted:"7",indexed:"999"}] }] },
      inspections: [{url:site, response:{inspectionResult:{indexStatusResult:{verdict:"PASS",coverageState:"Submitted and indexed",lastCrawlTime:"2026-11-25T10:00:00Z"}}}}],
    });
    expect(r.sitemap.processing).toBe("pending");
    expect(r.sitemap.errors).toBe(2);
    expect(r.sitemap.submittedUrls).toBe(7);
    expect(r.pages[0]!.state).toBe("indexed");
    expect(JSON.stringify(r)).not.toContain("999");
    expect(r.sitewideIndexedCount).toBeNull();
  });
  it("does not equate API errors or missing sitemap with indexed or zero pages", () => {
    const r = normalizeSearchConsole({checkedAt:"2026-11-26T19:00:00Z",sitemapResponse:{sitemap:[]},inspections:[{url:site,error:"inspection_unavailable"}]});
    expect(r.sitemap.processing).toBe("not_submitted");
    expect(r.sitemap.submittedUrls).toBeNull();
    expect(r.pages[0]!.state).toBe("unknown");
    expect(r.pages[0]!.error).toBe("inspection_unavailable");
    expect(r.sitewideIndexedCount).toBeNull();
  });
});
