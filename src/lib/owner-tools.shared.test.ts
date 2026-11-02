import { describe, expect, it } from "vitest";
import {
  claimInputSchema,
  parseEvidenceAssessment,
  normalizeSearchConsoleStatus,
} from "./owner-tools.shared";

describe("project-owner evidence review contracts", () => {
  const valid = {
    gaps: ["Source is not independently dated"],
    attackQuestions: ["Was the observation reproduced?"],
    nextGate: {
      name: "Independent reproduction",
      passCriteria: "A second operator verifies the result",
      requiredEvidence: ["Dated readback receipt"],
    },
  };
  it("accepts bounded claims and evidence", () => {
    expect(claimInputSchema.safeParse({claim:"This published page is reachable",evidence:["HTTP readback recorded at 12:00 UTC"]}).success).toBe(true);
    expect(claimInputSchema.safeParse({claim:"short",evidence:[]}).success).toBe(false);
    expect(claimInputSchema.safeParse({claim:"x".repeat(2100),evidence:["evidence present"]}).success).toBe(false);
  });
  it("accepts structured review without claiming validation of evidence", () => {
    expect(parseEvidenceAssessment(JSON.stringify(valid))).toEqual(valid);
  });
  it("rejects malformed or unconstrained model output", () => {
    expect(() => parseEvidenceAssessment("not JSON")).toThrow();
    expect(() => parseEvidenceAssessment(JSON.stringify({...valid, nextGate:null}))).toThrow();
    expect(() => parseEvidenceAssessment(JSON.stringify({...valid, attackQuestions:Array(20).fill("Question")}))).toThrow();
    expect(() => parseEvidenceAssessment(JSON.stringify({...valid, verified:true}))).toThrow();
  });
});

describe("Search Console report normalization", () => {
  it("preserves missing counts as unknown and labels site URL inspections as samples", () => {
    const result = normalizeSearchConsoleStatus({
      checkedAt: "2026-11-02T20:00:00.000Z",
      property: "https://truthweaver.jussco.company/",
      sitemaps: [{path:"https://truthweaver.jussco.company/sitemap.xml",isPending:false,errors:0,warnings:0}],
      pages: [{url:"https://truthweaver.jussco.company/",result:{indexStatusResult:{verdict:"PASS",coverageState:"Submitted and indexed",lastCrawlTime:"2026-11-01T10:00:00Z"}}}],
    });
    expect(result.sitemaps[0].submitted).toBeNull();
    expect(result.sitemaps[0].indexed).toBeNull();
    expect(result.pages[0].coverageState).toBe("Submitted and indexed");
    expect(result.pages[0].verdict).toBe("PASS");
    expect(result.kind).toBe("sampled_url_inspections");
  });
  it("retains errors without inventing an indexed page count", () => {
    const result=normalizeSearchConsoleStatus({
      checkedAt:"2026-11-02T20:00:00.000Z",property:"https://truthweaver.jussco.company/",
      sitemaps:[],pages:[{url:"https://truthweaver.jussco.company/sources",error:"inspection_unavailable"}],
    });
    expect(result.pages[0].verdict).toBe("UNKNOWN");
    expect(result.pages[0].error).toBe("inspection_unavailable");
  });
});
