import { NOTICE_TEXT_MAX } from "./notice-analyzer";

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
    for (let i = 0; i < images.length; i++) {
      onProgress(`Reading page ${i + 1} of ${images.length} on your device…`);
      const { data } = await worker.recognize(images[i]!);
      parts.push(data.text.trim());
    }
    return parts.join("\n\n").trim();
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
  return checkText(await recognize([file], onProgress));
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
    return checkText(await recognize(canvases, onProgress));
  } finally {
    await doc.destroy();
  }
}
