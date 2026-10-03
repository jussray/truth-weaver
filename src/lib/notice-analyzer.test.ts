import { describe, expect, it } from "vitest";

import {
  NOTICE_AUTHORITY,
  noticeAnalyzerInputSchema,
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
