import { describe, expect, it } from "vitest";
import { NOTICE_AUTHORITY, type NoticeAnalyzerResult } from "./notice-analyzer";
import { buildNoticeSnapshotReport } from "./notice-report";

const result: NoticeAnalyzerResult = {
  criticalDeadlines: [
    {
      date: "2026-11-12",
      label: "Response date printed on notice",
      urgency: "soon",
      evidence: "Respond by November 12",
      needsVerification: true,
    },
  ],
  obligations: [
    {
      action: "Sender requests a written response",
      claimedBy: "Example agency",
      evidence: "Send a written response",
      needsVerification: true,
    },
  ],
  questionsForCounsel: ["Which official rule, if any, controls the response date?"],
  uncertainties: ["The issuing body's authority has not been verified."],
  authority: NOTICE_AUTHORITY,
  generatedAt: "2026-10-13T03:00:00.000Z",
  model: "test-fixture",
};

const input = {
  documentTitle: "Example notice",
  documentType: "Letter",
  issuer: "Example agency",
  receivedDate: "2026-10-12",
  jurisdictionType: "state" as const,
  jurisdictionDetail: "Pennsylvania",
};

describe("Notice Snapshot report formatter", () => {
  it("produces stable, source-labeled output with complete caution language", () => {
    const report = buildNoticeSnapshotReport(result, input);
    expect(report.filename).toBe("truth-weaver-notice-snapshot.txt");
    expect(report.mimeType).toBe("text/plain;charset=utf-8");
    expect(report).toEqual(buildNoticeSnapshotReport(result, input));
    expect(report.content).toContain("NOT LEGAL ADVICE");
    expect(report.content).toContain("NOT VERIFIED");
    expect(report.content).toContain("Pennsylvania");
    expect(report.content).toContain("Respond by November 12");
    expect(report.content).toContain("questionsForCounsel".replace("questionsForCounsel", "QUESTIONS TO RAISE WITH QUALIFIED COUNSEL"));
    expect(report.content).toContain(NOTICE_AUTHORITY.disclaimer);
  });

  it("does not copy the original notice body or unrelated account data into the report", () => {
    const inputWithUnexportedData = {
      ...input,
      noticeText: "PRIVATE ORIGINAL NOTICE BODY THAT MUST NOT BE COPIED",
      buyerEmail: "example-private@example.org",
    };
    const report = buildNoticeSnapshotReport(result, inputWithUnexportedData);
    expect(report.content).not.toContain("PRIVATE ORIGINAL NOTICE BODY");
    expect(report.content).not.toContain("example-private@example.org");
  });

  it("does not pretend that missing dates or demands were verified", () => {
    const report = buildNoticeSnapshotReport({
      ...result,
      criticalDeadlines: [],
      obligations: [],
      questionsForCounsel: [],
      uncertainties: [],
    }, input);
    expect(report.content).toContain("None extracted.");
    expect(report.content).toContain("not legal advice".toUpperCase());
    expect(report.content).toContain("governing law");
  });
});
