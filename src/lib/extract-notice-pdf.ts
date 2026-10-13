import { NOTICE_TEXT_MAX } from "./notice-analyzer";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 15;

/**
 * Extracts selectable PDF text on the client's device.
 * Does not OCR images, infer missing words, or send the PDF to a server.
 * The caller must obtain explicit consent before sending extracted text for analysis.
 */
export async function extractNoticePdfText(file: File): Promise<{ text: string; pages: number }> {
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    throw new Error("PDF must be nonempty and no larger than 5 MB.");
  }

  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await task.promise;
  const pages = document.numPages;
  try {
    if (pages > MAX_PAGES) throw new Error("PDF has too many pages (15 maximum).");
    const textPages: string[] = [];
    for (let pageNo = 1; pageNo <= pages; pageNo++) {
      const page = await document.getPage(pageNo);
      const content = await page.getTextContent();
      const words = content.items
        .filter((part): part is typeof part & { str: string } => "str" in part)
        .map((part) => part.str);
      textPages.push(words.join(" "));
    }
    const text = textPages.join("\n\n").trim();
    if (text.length < 40) {
      throw new Error("No sufficient selectable text found. Image-only or scanned PDFs need OCR; paste extracted text instead.");
    }
    if (text.length > NOTICE_TEXT_MAX) {
      throw new Error("Extracted PDF text is over the 25,000-character limit. Paste the relevant sections.");
    }
    return { text, pages };
  } finally {
    await document.destroy();
  }
}
