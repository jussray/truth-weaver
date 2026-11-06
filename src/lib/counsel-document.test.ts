import { describe, expect, it } from "vitest";

import { buildCounselDocument, parseStoredAnalysis, toStoredAnalysis } from "./counsel-document";
import { NOTICE_AUTHORITY, type NoticeAnalyzerResult } from "./notice-analyzer";

const result: NoticeAnalyzerResult = {
  criticalDeadlines: [{ date: "2026-11-01", label: "Pay or vacate", urgency: "critical", evidence: "within 10 days", needsVerification: true }],
  obligations: [{ action: "Pay $1,200 rent", claimedBy: "Landlord LLC", evidence: "Pay $1,200", needsVerification: true }],
  questionsForCounsel: ["Is a 10-day notice valid in Philadelphia?"],
  uncertainties: ["Service method unknown"],
  authority: NOTICE_AUTHORITY,
  generatedAt: "2026-10-25T06:00:00.000Z",
  model: "openai/gpt-6-astra",
};

const meta = {
  noticeText: "SECRET RAW NOTICE TEXT that must never be stored in the document",
  documentTitle: "Notice to Quit",
  documentType: "Eviction notice",
  issuer: "Landlord LLC",
  receivedDate: "2026-10-20",
  jurisdictionType: "state" as const,
  jurisdictionDetail: "Pennsylvania",
};

describe("Counsel document", () => {
  it("never stores the raw notice text", () => {
    const stored = JSON.stringify(toStoredAnalysis(meta, result));
    expect(stored).not.toContain("SECRET RAW NOTICE TEXT");
  });

  it("marks every deadline and demand as not verified and law status as UNVERIFIED LAW", () => {
    const doc = buildCounselDocument(toStoredAnalysis(meta, result));
    const deadlines = doc.sections.find((s) => s.id === "deadlines")!;
    const demands = doc.sections.find((s) => s.id === "obligations")!;
    expect(deadlines.items[0]!.flag).toContain("NOT VERIFIED");
    expect(demands.items[0]!.flag).toContain("NOT VERIFIED");
    expect(doc.meta).toContainEqual(["Law status", "UNVERIFIED LAW"]);
  });

  it("carries the non-authorizing banner and governing-law statement", () => {
    const doc = buildCounselDocument(toStoredAnalysis(meta, result));
    expect(doc.banner).toContain("NON-AUTHORIZING");
    expect(doc.banner).toContain("GOVERNING LAW IS THE AUTHORITY");
  });

  it("gives the same reference for the same analysis", () => {
    const a = buildCounselDocument(toStoredAnalysis(meta, result, new Date("2026-10-25T06:00:00Z")));
    const b = buildCounselDocument(toStoredAnalysis(meta, result, new Date("2026-10-26T06:00:00Z")));
    expect(a.reference).toBe(b.reference);
    expect(a.reference).toMatch(/^TW-C-[0-9A-F]{8}$/);
  });

  it("rejects tampered or malformed saved data", () => {
    expect(parseStoredAnalysis("{not json")).toBeNull();
    expect(parseStoredAnalysis(JSON.stringify({ version: 2 }))).toBeNull();
    const bad = toStoredAnalysis(meta, result) as unknown as { result: { criticalDeadlines: unknown[] } };
    bad.result.criticalDeadlines = [{ label: "x" }];
    expect(parseStoredAnalysis(JSON.stringify(bad))).toBeNull();
  });

  it("round-trips valid saved data", () => {
    const stored = toStoredAnalysis(meta, result);
    expect(parseStoredAnalysis(JSON.stringify(stored))).toEqual(stored);
  });
});
