import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

import type { PaidReportDocument, ReportBlock } from "./paid-report";
import { SNAPSHOT_MAX_BYTES } from "./snapshot-report-access";

/*
 * Server-side PDF renderer (pure JavaScript, no browser or filesystem APIs).
 * The server cannot read CSS variables, so these are the sRGB values of the
 * brand tokens, matching the fallbacks used by the in-browser Counsel PDF.
 */
const FOREST = rgb(16 / 255, 40 / 255, 32 / 255);
const GOLD = rgb(196 / 255, 160 / 255, 82 / 255);
const PARCHMENT = rgb(240 / 255, 232 / 255, 214 / 255);
const INK = rgb(12 / 255, 14 / 255, 20 / 255);
const WARN = rgb(176 / 255, 110 / 255, 20 / 255);
const RULE = rgb(214 / 255, 200 / 255, 168 / 255);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const BOTTOM = 62;
const CONTENT_W = PAGE_W - MARGIN * 2;

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const SUBSTITUTES: Record<string, string> = {
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2212": "-", "\u2015": "—",
  "\u2032": "'", "\u2033": "\"", "\u2264": "<=", "\u2265": ">=", "\u2192": "->", "\u2190": "<-",
  "\u2610": "[ ]", "\u2611": "[x]", "\u2713": "x",
};

function winAnsiChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.includes(ch);
}

/** Standard PDF fonts only encode WinAnsi. Unsupported characters become "?" and are reported. */
export function toWinAnsi(text: string): { text: string; replaced: boolean } {
  let replaced = false;
  let out = "";
  for (const ch of text.normalize("NFC")) {
    if (ch === "\n" || ch === "\t" || ch === "\r") { out += " "; continue; }
    if (winAnsiChar(ch)) { out += ch; continue; }
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code < 0xa0) || ch === "\u200b" || ch === "\u00ad" || ch === "\ufeff") continue;
    const sub = SUBSTITUTES[ch];
    if (sub !== undefined) { out += sub; continue; }
    const base = ch.normalize("NFKD").replace(/\p{M}+/gu, "");
    if (base && [...base].every(winAnsiChar)) { out += base; continue; }
    out += "?";
    replaced = true;
  }
  return { text: out, replaced };
}

type Fonts = { sans: PDFFont; sansBold: PDFFont; serifBold: PDFFont; serifItalic: PDFFont; serif: PDFFont };

class Writer {
  page!: PDFPage;
  y = 0;
  replaced = false;
  constructor(private pdf: PDFDocument, readonly fonts: Fonts) {}

  safe(text: string): string {
    const r = toWinAnsi(text);
    if (r.replaced) this.replaced = true;
    return r.text;
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const words = this.safe(text).split(" ").filter(Boolean);
    const lines: string[] = [];
    let line = "";
    const fits = (s: string) => font.widthOfTextAtSize(s, size) <= width;
    for (let word of words) {
      while (!fits(word)) {
        let cut = word.length - 1;
        while (cut > 1 && !fits(word.slice(0, cut))) cut--;
        if (line) { lines.push(line); line = ""; }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) line = next;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  text(text: string, opts: { font?: PDFFont; size?: number; color?: RGB; indent?: number; gap?: number; width?: number }) {
    const font = opts.font ?? this.fonts.sans;
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    const lh = size * 1.38;
    for (const line of this.wrap(text, font, size, opts.width ?? CONTENT_W - indent)) {
      this.ensure(lh);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lh;
    }
    this.y -= opts.gap ?? 0;
  }

  rule(color = GOLD, thickness = 1) {
    this.ensure(10);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness, color });
    this.y -= 10;
  }
}

function drawCover(w: Writer, doc: PaidReportDocument) {
  w.newPage();
  w.page.drawRectangle({ x: 0, y: PAGE_H - 124, width: PAGE_W, height: 124, color: FOREST });
  w.page.drawRectangle({ x: 0, y: PAGE_H - 127, width: PAGE_W, height: 3, color: GOLD });
  w.page.drawText(w.safe(doc.title), { x: MARGIN, y: PAGE_H - 56, size: 26, font: w.fonts.serifBold, color: GOLD });
  const subtitle = w.wrap(doc.subtitle, w.fonts.serifItalic, 13, CONTENT_W)[0] ?? "";
  w.page.drawText(subtitle, { x: MARGIN, y: PAGE_H - 80, size: 13, font: w.fonts.serifItalic, color: PARCHMENT });
  w.page.drawText(w.safe(doc.banner.join("   ·   ")), { x: MARGIN, y: PAGE_H - 104, size: 7.5, font: w.fonts.sansBold, color: GOLD });
  w.y = PAGE_H - 150;
  for (const [label, value] of doc.meta) {
    const lines = w.wrap(value, w.fonts.sans, 9.5, CONTENT_W - 140);
    w.ensure(lines.length * 13 + 4);
    w.page.drawText(w.safe(label.toUpperCase()), { x: MARGIN, y: w.y - 9.5, size: 8, font: w.fonts.sansBold, color: FOREST });
    lines.forEach((line, i) => w.page.drawText(line, { x: MARGIN + 140, y: w.y - 9.5 - i * 13, size: 9.5, font: w.fonts.sans, color: INK }));
    w.y -= lines.length * 13 + 5;
  }
  w.y -= 8;
  w.text("What is inside", { font: w.fonts.serifBold, size: 14, color: FOREST, gap: 4 });
  for (const part of doc.parts) w.text(`• ${part.title}`, { size: 10, indent: 8, gap: 1 });
}

function drawTable(w: Writer, block: Extract<ReportBlock, { type: "table" }>) {
  const { sans, sansBold } = w.fonts;
  const widths = block.widths.map((f) => f * CONTENT_W);
  const pad = 4;
  const drawRow = (cells: string[], header: boolean, minHeight: number) => {
    const font = header ? sansBold : sans;
    const size = header ? 8 : 8.5;
    const wrapped = cells.map((c, i) => w.wrap(c, font, size, (widths[i] ?? 40) - pad * 2));
    const height = Math.max(minHeight, ...wrapped.map((l) => l.length * size * 1.3 + pad * 2));
    w.ensure(height);
    let x = MARGIN;
    widths.forEach((cw, i) => {
      w.page.drawRectangle({ x, y: w.y - height, width: cw, height, borderColor: RULE, borderWidth: 0.75, ...(header ? { color: FOREST } : {}) });
      (wrapped[i] ?? []).forEach((line, j) => w.page.drawText(line, {
        x: x + pad, y: w.y - pad - size - j * size * 1.3, size, font, color: header ? PARCHMENT : INK,
      }));
      x += cw;
    });
    w.y -= height;
  };
  drawRow(block.columns, true, 18);
  for (const row of block.rows) drawRow(row, false, 22);
  for (let i = 0; i < block.blankRows; i++) drawRow(block.columns.map(() => ""), false, 22);
  w.y -= 10;
}

function drawBlock(w: Writer, block: ReportBlock) {
  const f = w.fonts;
  switch (block.type) {
    case "subheading":
      w.ensure(44);
      w.y -= 6;
      w.rule(GOLD, 0.75);
      w.text(block.text, { font: f.serifBold, size: 14, color: FOREST, gap: 4 });
      return;
    case "paragraph":
      w.text(block.text, { size: 10, gap: 6 });
      return;
    case "bullets":
      for (const item of block.items) w.text(`•  ${item}`, { size: 10, indent: 8, gap: 2 });
      w.y -= 4;
      return;
    case "numbered":
      block.items.forEach((item, i) => w.text(`${i + 1}.  ${item}`, { size: 10, indent: 8, gap: 2 }));
      w.y -= 4;
      return;
    case "fields":
      for (const [label, value] of block.rows) {
        const lines = w.wrap(value, f.sans, 9.5, CONTENT_W - 130);
        w.ensure(lines.length * 13 + 4);
        w.page.drawText(w.safe(label.toUpperCase()), { x: MARGIN, y: w.y - 9.5, size: 8, font: f.sansBold, color: FOREST });
        lines.forEach((line, i) => w.page.drawText(line, { x: MARGIN + 130, y: w.y - 9.5 - i * 13, size: 9.5, font: f.sans, color: INK }));
        w.y -= lines.length * 13 + 5;
      }
      w.y -= 4;
      return;
    case "item":
      w.ensure(36);
      w.text(block.title, { font: f.sansBold, size: 10.5, gap: 2 });
      for (const line of block.lines) w.text(line, { size: 9.5, indent: 10, gap: 1 });
      if (block.flag) w.text(block.flag.toUpperCase(), { font: f.sansBold, size: 7.5, color: WARN, indent: 10 });
      w.y -= 8;
      return;
    case "blanks":
      w.ensure(18 + block.lines * 20);
      w.text(block.label, { font: f.sansBold, size: 9.5, gap: 2 });
      for (let i = 0; i < block.lines; i++) {
        w.y -= 18;
        w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: PAGE_W - MARGIN, y: w.y }, thickness: 0.6, color: RULE });
      }
      w.y -= 10;
      return;
    case "table":
      drawTable(w, block);
      return;
    case "letter": {
      const size = 10.5;
      const lh = size * 1.4;
      const wrapped = block.lines.flatMap((line) => (line ? w.wrap(line, f.serif, size, CONTENT_W - 32) : [""]));
      const height = wrapped.length * lh + 24;
      if (height < PAGE_H - MARGIN - BOTTOM) w.ensure(height);
      const top = w.y;
      w.y -= 12;
      for (const line of wrapped) {
        w.ensure(lh);
        if (line) w.page.drawText(line, { x: MARGIN + 16, y: w.y - size, size, font: f.serif, color: INK });
        w.y -= lh;
      }
      w.y -= 12;
      if (height < PAGE_H - MARGIN - BOTTOM) {
        w.page.drawRectangle({ x: MARGIN, y: w.y, width: CONTENT_W, height: top - w.y, borderColor: GOLD, borderWidth: 0.75 });
      }
      w.y -= 10;
      return;
    }
  }
}

/** Renders the paid report to PDF bytes, bounded by the private delivery size limit. */
export async function renderPaidReportPdf(doc: PaidReportDocument, createdAt: Date): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(`${doc.title}: ${doc.subtitle}`).text);
  pdf.setAuthor("Truth Weaver Counsel");
  pdf.setSubject("Educational notice research aid. Not legal advice. Governing law is the authority.");
  pdf.setCreator("Truth Weaver Counsel");
  pdf.setProducer("Truth Weaver Counsel");
  pdf.setCreationDate(createdAt);
  pdf.setModificationDate(createdAt);
  const fonts: Fonts = {
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    serifBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
  };
  const w = new Writer(pdf, fonts);
  drawCover(w, doc);

  for (const part of doc.parts) {
    w.newPage();
    w.page.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: FOREST });
    w.page.drawRectangle({ x: 0, y: PAGE_H - 72, width: PAGE_W, height: 2, color: GOLD });
    w.page.drawText(w.safe(part.title), { x: MARGIN, y: PAGE_H - 44, size: 20, font: fonts.serifBold, color: GOLD });
    w.y = PAGE_H - 92;
    w.text(part.intro, { font: fonts.serifItalic, size: 11, color: FOREST, gap: 8 });
    for (const block of part.blocks) drawBlock(w, block);
  }

  w.ensure(80);
  w.y -= 6;
  w.rule();
  w.text("Source and authority limits", { font: fonts.serifBold, size: 13, color: FOREST, gap: 4 });
  for (const limit of doc.limits) w.text(`•  ${limit}`, { size: 9, gap: 2 });
  if (w.replaced) {
    w.text("Some characters in your analysis cannot be shown in this PDF and appear as \"?\". Your saved analysis in your Truth Weaver account shows the original text.", { size: 9, color: WARN, gap: 2 });
  }

  const pages = pdf.getPages();
  pages.forEach((page, i) => {
    page.drawText(toWinAnsi(`${doc.reference}  ·  NON-AUTHORIZING  ·  GOVERNING LAW IS THE AUTHORITY`).text, { x: MARGIN, y: 30, size: 7.5, font: fonts.sans, color: FOREST });
    const label = `Page ${i + 1} of ${pages.length}`;
    page.drawText(label, { x: PAGE_W - MARGIN - fonts.sans.widthOfTextAtSize(label, 7.5), y: 30, size: 7.5, font: fonts.sans, color: FOREST });
  });

  const bytes = await pdf.save();
  if (bytes.byteLength <= 0 || bytes.byteLength > SNAPSHOT_MAX_BYTES) throw new Error("Report exceeds the delivery size limit.");
  return bytes;
}
