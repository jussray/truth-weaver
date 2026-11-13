/**
 * Minimal JPEG-in-PDF writer for user-initiated, offline multi-page exports.
 * Does not create legal conclusions, upload pages, or call any remote service.
 * Each source image is already prepared as JPEG by the scanner.
 */
export type ScannedJpegPage = { jpeg: Uint8Array; width: number; height: number };

export function createScannedPdf(pages: readonly ScannedJpegPage[]): Blob {
  if (pages.length < 1 || pages.length > 6) throw new Error("A scan PDF must contain 1–6 pages.");
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let offset = 0;
  const append = (bytes: Uint8Array) => { chunks.push(bytes); offset += bytes.byteLength; };
  const ascii = (text: string) => append(encoder.encode(text));
  const begin = (id: number) => { offsets[id] = offset; ascii(`${id} 0 obj\n`); };
  const end = () => ascii("endobj\n");
  ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  begin(1); ascii("<< /Type /Catalog /Pages 2 0 R >>\n"); end();
  begin(2);
  ascii(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + 3 * index} 0 R`).join(" ")}] >>\n`);
  end();

  pages.forEach(({ jpeg, width, height }, index) => {
    if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height) ||
        jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[jpeg.length - 2] !== 0xff || jpeg[jpeg.length - 1] !== 0xd9) {
      throw new Error("The scan contains an invalid JPEG page.");
    }
    const pageId = 3 + 3 * index;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const paperWidth = 595;
    const paperHeight = 842;
    const scale = Math.min((paperWidth - 48) / width, (paperHeight - 48) / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const x = (paperWidth - drawWidth) / 2;
    const y = (paperHeight - drawHeight) / 2;
    begin(pageId);
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${paperWidth} ${paperHeight}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`);
    end();
    begin(imageId);
    ascii(`<< /Type /XObject /Subtype /Image /Width ${Math.round(width)} /Height ${Math.round(height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    append(jpeg);
    ascii("\nendstream\n");
    end();
    const commands = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
    begin(contentId);
    ascii(`<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream\n`);
    end();
  });

  const xref = offset;
  ascii(`xref\n0 ${3 + pages.length * 3}\n0000000000 65535 f \n`);
  for (let id = 1; id < 3 + pages.length * 3; id++) {
    ascii(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  ascii(`trailer\n<< /Size ${3 + pages.length * 3} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
