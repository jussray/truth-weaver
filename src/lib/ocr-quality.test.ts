import { describe, expect, it } from "vitest";

import { OCR_MIN_CONFIDENCE, assessOcrQuality } from "./ocr-quality";

describe("OCR blur gate", () => {
  it("requires at least 85% clarity", () => expect(OCR_MIN_CONFIDENCE).toBe(85));
  it("accepts a clear scan at 85%", () => expect(assessOcrQuality([92, 85]).ok).toBe(true));
  it("rejects when any page is below 85%", () => {
    const q = assessOcrQuality([97, 84.9]);
    expect(q.ok).toBe(false);
    expect(q.confidence).toBe(84.9);
  });
  it("rejects a very blurry scan (below 25%)", () => expect(assessOcrQuality([20]).ok).toBe(false));
  it("rejects an empty read", () => expect(assessOcrQuality([]).ok).toBe(false));
});
