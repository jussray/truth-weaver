import { NOTICE_TEXT_MAX } from "./notice-analyzer";
import { assessOcrQuality } from "./ocr-quality";

/** Thrown when a scan is too blurry/unclear; the caller must block analysis. */
export class OcrUnreadableError extends Error {
  override name = "OcrUnreadableError";
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_OCR_PAGES = 6;

export type OcrProgress = (message: string) => void;

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
    const quality = assessOcrQuality(confidence);
    if (!quality.ok) throw new OcrUnreadableError(quality.reason);
    const averageConfidence = confidence.reduce((sum, value) => sum + value, 0) / confidence.length;
    return { text, averageConfidence };
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
    const result = await recognize(canvases, onProgress);
    return { ...result, text: checkText(result.text) };
  } finally {
    await doc.destroy();
  }
}
