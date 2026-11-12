import { describe, expect, it } from "vitest";
import { assessOcrQuality } from "./ocr-notice";

const text = "The attached notice requests a response by October twenty fourth and contains several statements requiring independent review.";

describe("scanned notice OCR warnings", () => {
  it("warns when confidence is low or missing", () => {
    expect(assessOcrQuality(text, 40)).toMatch(/blurry, incomplete, or unreadable/);
    expect(assessOcrQuality(text, Number.NaN)).toMatch(/unreadable/);
  });
  it("warns when too few words were detected despite high confidence", () => {
    expect(assessOcrQuality("blurred page", 98)).toMatch(/Retake the photo/);
  });
  it("flags moderate confidence for manual verification", () => {
    expect(assessOcrQuality(text, 76)).toMatch(/Compare names, dates, amounts/);
  });
  it("does not issue an additional quality warning on a legible scan", () => {
    expect(assessOcrQuality(text, 95)).toBeNull();
  });
});
