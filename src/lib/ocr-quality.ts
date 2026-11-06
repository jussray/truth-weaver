/**
 * Strict anti-hallucination rule for machine-read notices.
 * Any page read below this confidence is treated as blurry/unreadable:
 * analysis is blocked and the user must retake or rescan the document.
 */
export const OCR_MIN_CONFIDENCE = 85;

export type OcrQuality =
  | { ok: true; confidence: number }
  | { ok: false; confidence: number; reason: string };

export function assessOcrQuality(pageConfidences: readonly number[]): OcrQuality {
  if (pageConfidences.length === 0 || pageConfidences.some((c) => !Number.isFinite(c))) {
    return { ok: false, confidence: 0, reason: "Nothing readable was found. Retake the photo or rescan the document." };
  }
  const worst = Math.min(...pageConfidences);
  if (worst < OCR_MIN_CONFIDENCE) {
    return {
      ok: false,
      confidence: worst,
      reason: `This scan is too blurry or unclear to read reliably (clarity ${Math.round(worst)}%, needs ${OCR_MIN_CONFIDENCE}%+). Retake the photo in bright, even light with the whole page flat and in focus. Nothing was analyzed.`,
    };
  }
  return { ok: true, confidence: worst };
}
