import { describe, expect, it } from "vitest";
import {
  evidenceReviewInputSchema,
  parseEvidenceReview,
  summarizeIndexStatus,
  searchablePages,
} from "./owner-intelligence";

describe("owner evidence review contract", () => {
  it("requires a meaningful claim and at least one bounded piece of evidence", () => {
    expect(evidenceReviewInputSchema.safeParse({ claim: "Too short", evidence: [] }).success).toBe(false);
    expect(evidenceReviewInputSchema.safeParse({
      claim: "Our public sitemap is being processed by Google.",
      evidence: [{ label: "Search Console", summary: "Sitemap submitted", sourceUrl: "http://localhost:3000" }],
    }).success).toBe(false);
    expect(evidenceReviewInputSchema.safeParse({
      claim: "Our public sitemap is being processed by Google.",
      evidence: [{ label: "Search Console", summary: "Sitemap submitted", sourceUrl: "https://example.org/report" }],
    }).success).toBe(true);
  });
  it("fails closed on model prose or unstructured outcomes", () => {
    expect(() => parseEvidenceReview("Everything is proven!")).toThrow();
    expect(() => parseEvidenceReview(JSON.stringify({
      evidenceGaps: [],
      attackQuestions: [],
      nextGate: { action: "Ship", requiredProof: "None", passCriterion: "None" },
      verified: true,
    }))).toThrow();
  });
  it("accepts bounded adversarial questions without granting truth status", () => {
    const result = parseEvidenceReview(JSON.stringify({
      evidenceGaps: ["No URL inspection response was provided."],
      attackQuestions: ["Was indexing checked for the exact canonical URL?"],
      nextGate: {
        action: "Run URL Inspection for the canonical page",
        requiredProof: "Timestamped property-scoped API response",
        passCriterion: "Response reports PASS for the intended canonical URL",
      },
    }));
    expect(result.nextGate.action).toContain("URL Inspection");
    expect("verified" in result).toBe(false);
  });
});

describe("Search Console status view", () => {
  it("includes only the six public indexable canonical paths", () => {
    expect(searchablePages()).toHaveLength(6);
    expect(searchablePages()).not.toContainEqual(expect.stringContaining("/merchant"));
  });
  it("keeps missing and error responses UNKNOWN, never indexed by default", () => {
    expect(summarizeIndexStatus("https://truthweaver.jussco.company/shop", undefined).status).toBe("UNKNOWN");
    expect(summarizeIndexStatus("https://truthweaver.jussco.company/shop", {
      indexStatusResult: { verdict: "NEUTRAL", coverageState: "Crawled - currently not indexed" },
    }).status).toBe("NOT_INDEXED");
  });
  it("only treats a positive indexed verdict as INDEXED", () => {
    expect(summarizeIndexStatus("https://truthweaver.jussco.company/", {
      indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed" },
    }).status).toBe("INDEXED");
  });
});
