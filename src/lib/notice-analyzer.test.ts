import { describe, expect, it } from "vitest";

import {
  NOTICE_AUTHORITY,
  noticeAnalyzerInputSchema,
  enforceNoticeSourceState,
  parseNoticeAnalyzerModelText,
} from "./notice-analyzer";

describe("notice analyzer contracts", () => {
  it("requires a concrete jurisdiction detail outside the federal lane", () => {
    const parsed = noticeAnalyzerInputSchema.safeParse({
      noticeText: "This is a sufficiently long sample notice used only to validate the input contract.",
      jurisdictionType: "state",
      jurisdictionDetail: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("requires the user to choose a jurisdiction and a valid date", () => {
    const base = {
      noticeText: "This is a sufficiently long sample notice used only to validate the input contract.",
      jurisdictionType: "",
      jurisdictionDetail: "",
      receivedDate: "",
    };
    expect(noticeAnalyzerInputSchema.safeParse(base).success).toBe(false);
    expect(noticeAnalyzerInputSchema.safeParse({ ...base, jurisdictionType: "federal", receivedDate: "2026-02-30" }).success).toBe(false);
    expect(noticeAnalyzerInputSchema.safeParse({ ...base, jurisdictionType: "state", jurisdictionDetail: "Pennsylvania", receivedDate: "2026-10-13" }).success).toBe(true);
  });

  it("never upgrades claims in a notice into verified law", () => {
    const result = enforceNoticeSourceState({
      criticalDeadlines: [{ date: "2026-10-20", label: "Sender requests response", urgency: "soon", evidence: "Respond by 10/20", needsVerification: false }],
      obligations: [{ action: "Reply", claimedBy: "Sender", evidence: "Reply required", needsVerification: false }],
      questionsForCounsel: [], uncertainties: [],
    });
    expect(result.criticalDeadlines[0]?.needsVerification).toBe(true);
    expect(result.obligations[0]?.needsVerification).toBe(true);
  });

  it("accepts valid source-bound structured output", () => {
    const parsed = parseNoticeAnalyzerModelText(`\n\n\`\`\`json\n{
      "criticalDeadlines": [{
        "date": "October 20, 2026",
        "label": "Written response requested",
        "urgency": "soon",
        "evidence": "A written response is requested by October 20, 2026.",
        "needsVerification": true
      }],
      "obligations": [],
      "questionsForCounsel": ["Is the stated response date legally controlling in this jurisdiction?"],
      "uncertainties": ["The notice alone does not establish the governing response rule."]
    }\n\`\`\``);

    expect(parsed.criticalDeadlines).toHaveLength(1);
    expect(parsed.criticalDeadlines[0]?.needsVerification).toBe(true);
    expect(NOTICE_AUTHORITY.status).toBe("NON-AUTHORIZING");
    expect(NOTICE_AUTHORITY.statement).toBe("GOVERNING LAW IS THE AUTHORITY");
  });

  it("fails closed on malformed model output instead of inventing a fallback", () => {
    expect(() => parseNoticeAnalyzerModelText("Here is your answer: no structured result."))
      .toThrow(/JSON object/i);
  });
});
