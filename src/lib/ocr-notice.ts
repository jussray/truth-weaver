import { NOTICE_TEXT_MAX } from "./notice-analyzer";
import { assessOcrQuality as assessScanLegibility } from "./ocr-quality";

/** Unreadable OCR must block legal notice analysis. */
export class OcrUnreadableError extends Error {
  override name = "OcrUnreadableError";
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_OCR_PAGES = 6;

export type OcrProgress = (message: string) => void;

/** OCR confidence is a review warning, never verification of a legal deadline. */
export function assessOcrQuality(text: string, averageConfidence: number): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!Number.isFinite(averageConfidence) || averageConfidence < 65 || words.length < 12) {
    return "Warning: this scan may be blurry, incomplete, or unreadable. Retake the photo in bright light, hold the camera steady, or paste the original text. Do not rely on extracted dates or amounts.";
  }
  if (averageConfidence < 85) {
    return "Warning: some scanned words may be inaccurate. Compare names, dates, amounts and deadlines against the original document.";
  }
  return null;
}

/**
 * On-device OCR (English). Lazy-loads tesseract.js in the browser only.
 * OCR output is machine-read text: it can contain misreadings and must be
 * reviewed by the user before analysis. It never becomes verified law.
 */
async function recognize(images: Array<Blob | HTMLCanvasElement>, onProgress: OcrProgress) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const parts: string[] = [];
    const confidence: number[] = [];
    for (let i = 0; i < images.length; i++) {
      onProgress(`Reading page ${i + 1} of ${images.length} on your device…`);
      const { data } = await worker.recognize(images[i]!);
      parts.push(data.text.trim());
      confidence.push(data.confidence);
    }
    const text = parts.join("\n\n").trim();
    const quality = assessScanLegibility(confidence);
    if (!quality.ok) throw new OcrUnreadableError(quality.reason);
    const averageConfidence = confidence.reduce((sum, value) => sum + value, 0) / confidence.length;
    return { text, averageConfidence, qualityWarning: assessOcrQuality(text, averageConfidence) };
  } finally {
    await worker.terminate();
  }
}

function checkText(text: string) {
  if (text.length < 40) throw new Error("Could not read enough text from this scan. Try a sharper, well-lit image or paste the text.");
  if (text.length > NOTICE_TEXT_MAX) throw new Error("Scanned text is over the 25,000-character limit. Paste the relevant sections.");
  return text;
}

export async function ocrNoticeImage(file: File, onProgress: OcrProgress) {
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) throw new Error("Image must be nonempty and no larger than 8 MB.");
  const result = await recognize([file], onProgress);
  return { ...result, text: checkText(result.text) };
}

/** OCR captured camera pages together, including short pages, without uploading them. */
export async function ocrNoticeImages(files: File[], onProgress: OcrProgress) {
  if (!files.length || files.length > MAX_OCR_PAGES) {
    throw new Error(`Choose between one and ${MAX_OCR_PAGES} scanned pages.`);
  }
  if (files.some((file) => file.size === 0 || file.size > MAX_IMAGE_BYTES || !/^image\/(png|jpeg|webp)$/.test(file.type))) {
    throw new Error("Each scanned image must be PNG, JPG or WebP and no larger than 8 MB.");
  }
  const result = await recognize(files, onProgress);
  return { ...result, text: checkText(result.text) };
}

export async function ocrNoticePdf(file: File, onProgress: OcrProgress) {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    if (doc.numPages > MAX_OCR_PAGES) throw new Error(`Scanned PDFs are limited to ${MAX_OCR_PAGES} pages for on-device reading.`);
    const canvases: HTMLCanvasElement[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(`Preparing page ${n} of ${doc.numPages}…`);
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      canvases.push(canvas);
    }
    // Avoid loading OCR for a wholly blank PDF. Rendering can succeed even when
    // there are no pixels to recognize (e.g. a PDF containing an empty text run).
    // Treat transparent and near-white pixels as paper, not extracted evidence.
    const hasInk = canvases.some((canvas) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return true; // If inspection is unavailable, do not guess blank.
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3] ?? 0;
        const red = pixels[i] ?? 255;
        const green = pixels[i + 1] ?? 255;
        const blue = pixels[i + 2] ?? 255;
        if (alpha > 12 && (red < 245 || green < 245 || blue < 245)) return true;
      }
      return false;
    });
    if (!hasInk) throw new Error("Blank PDF has no visible text or imagery to read. Paste the notice text or choose a readable scan.");
    const result = await recognize(canvases, onProgress);
    return { ...result, text: checkText(result.text) };
  } finally {
    await doc.destroy();
  }
}
