import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import {
  NOTICE_PDF_MAX_PAGES,
  type ExtractedNoticePage,
  type SupportedNoticeImageType,
} from "./notice-document";

export type PdfOcrFallback = (input: {
  fileName: string;
  mimeType: SupportedNoticeImageType;
  base64: string;
}) => Promise<string>;

function normalizeExtractedText(parts: string[]) {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

async function renderPdfPageToJpeg(page: {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<unknown> };
}) {
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser could not prepare a scanned PDF page for transcription.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export async function extractPdfPages(file: File, ocrFallback: PdfOcrFallback): Promise<ExtractedNoticePage[]> {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;

  if (document.numPages > NOTICE_PDF_MAX_PAGES) {
    await document.destroy();
    throw new Error(`PDFs are limited to ${NOTICE_PDF_MAX_PAGES} pages for this analyzer.`);
  }

  const pages: ExtractedNoticePage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = normalizeExtractedText(
        textContent.items.map((item) => ("str" in item ? item.str : "")),
      );

      if (text) {
        pages.push({ page: pageNumber, text });
        continue;
      }

      const base64 = await renderPdfPageToJpeg(page);
      const ocrText = (await ocrFallback({
        fileName: `${file.name} page ${pageNumber}`,
        mimeType: "image/jpeg",
        base64,
      })).trim();

      if (ocrText) {
        pages.push({ page: pageNumber, text: ocrText });
      }
    }
  } finally {
    await document.destroy();
  }

  if (!pages.length) {
    throw new Error("No readable text was extracted from that PDF.");
  }

  return pages;
}
