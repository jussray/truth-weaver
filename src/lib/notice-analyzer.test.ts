import { describe, expect, it } from "vitest";

import {
  NOTICE_AUTHORITY,
  noticeAnalyzerInputSchema,
  parseNoticeAnalyzerModelText,
} from "./notice-analyzer";
import {
  formatExtractedPages,
  imageExtractionInputSchema,
  parseImageTranscriptionModelText,
  sanitizeSourceName,
} from "./notice-document";

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

describe("notice document extraction contracts", () => {
  it("preserves source and page provenance in analyzer text", () => {
    const formatted = formatExtractedPages("hearing-notice.pdf", [
      { page: 2, text: "Second page text." },
      { page: 1, text: "First page text." },
    ]);

    expect(formatted).toBe(
      "[SOURCE: hearing-notice.pdf | PAGE 1]\nFirst page text.\n\n[SOURCE: hearing-notice.pdf | PAGE 2]\nSecond page text.",
    );
  });

  it("sanitizes marker-like filename characters", () => {
    expect(sanitizeSourceName("notice]\n[SOURCE: fake | PAGE 9].pdf"))
      .toBe("notice SOURCE: fake | PAGE 9 .pdf");
  });

  it("accepts only supported image formats for transcription", () => {
    const valid = imageExtractionInputSchema.safeParse({
      fileName: "notice.png",
      mimeType: "image/png",
      base64: "aGVsbG8taW1hZ2UtdGV4dA==",
    });
    const invalid = imageExtractionInputSchema.safeParse({
      fileName: "notice.gif",
      mimeType: "image/gif",
      base64: "aGVsbG8taW1hZ2UtdGV4dA==",
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("validates transcription JSON and rejects commentary", () => {
    expect(parseImageTranscriptionModelText('{"text":"NOTICE OF HEARING"}').text)
      .toBe("NOTICE OF HEARING");
    expect(() => parseImageTranscriptionModelText("No readable text."))
      .toThrow(/JSON object/i);
  });
});
