import type { CounselDocument } from "./counsel-document";

type RGB = [number, number, number];

/**
 * Resolves a brand CSS variable to sRGB by painting one pixel, so the PDF
 * uses the live design tokens (which may be authored in oklch) instead of
 * hard-coded colors. Browser-only.
 */
function tokenRgb(variable: string, fallback: RGB): RGB {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    if (!ctx || !value) return fallback;
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r ?? fallback[0], g ?? fallback[1], b ?? fallback[2]];
  } catch {
    return fallback;
  }
}

/** Builds and downloads the branded Counsel PDF. Lazy-loads jsPDF in the browser only. */
export async function downloadCounselPdf(doc: CounselDocument): Promise<void> {
  const { jsPDF } = await import("jspdf");
  // Neutral fallbacks are used only if a token cannot be resolved at runtime.
  const forest = tokenRgb("--forest-deep", [16, 40, 32]);
  const gold = tokenRgb("--gold", [196, 160, 82]);
  const parchment = tokenRgb("--parchment", [240, 232, 214]);
  const ink = tokenRgb("--ink", [12, 14, 20]);
  const warn = tokenRgb("--warn", [176, 110, 20]);

  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 54;
  const contentW = W - M * 2;
  const bottom = H - 60;
  let y = 0;

  const ensure = (needed: number) => {
    if (y + needed > bottom) {
      pdf.addPage();
      y = M;
    }
  };

  const write = (text: string, opts: { size: number; font?: "helvetica" | "times"; style?: "normal" | "bold" | "italic"; color?: RGB; indent?: number; gap?: number }) => {
    pdf.setFont(opts.font ?? "helvetica", opts.style ?? "normal");
    pdf.setFontSize(opts.size);
    pdf.setTextColor(...(opts.color ?? ink));
    const lines = pdf.splitTextToSize(text, contentW - (opts.indent ?? 0)) as string[];
    const lh = opts.size * 1.35;
    for (const line of lines) {
      ensure(lh);
      pdf.text(line, M + (opts.indent ?? 0), y + opts.size);
      y += lh;
    }
    y += opts.gap ?? 0;
  };

  // Header band
  pdf.setFillColor(...forest);
  pdf.rect(0, 0, W, 112, "F");
  pdf.setFillColor(...gold);
  pdf.rect(0, 112, W, 3, "F");
  pdf.setFont("times", "bold");
  pdf.setFontSize(26);
  pdf.setTextColor(...gold);
  pdf.text(doc.title, M, 52);
  pdf.setFont("times", "italic");
  pdf.setFontSize(13);
  pdf.setTextColor(...parchment);
  pdf.text(pdf.splitTextToSize(doc.subtitle, contentW)[0] ?? doc.subtitle, M, 74);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...gold);
  pdf.text(doc.banner.join("   ·   "), M, 96);
  y = 138;

  // Metadata table
  pdf.setFontSize(9);
  for (const [label, value] of doc.meta) {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...forest);
    const valueLines = pdf.splitTextToSize(value, contentW - 150) as string[];
    ensure(valueLines.length * 12 + 4);
    pdf.text(label.toUpperCase(), M, y + 9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...ink);
    pdf.text(valueLines, M + 150, y + 9);
    y += valueLines.length * 12 + 4;
  }
  y += 10;

  for (const section of doc.sections) {
    ensure(40);
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(1);
    pdf.line(M, y, W - M, y);
    y += 10;
    write(section.heading, { size: 15, font: "times", style: "bold", color: forest, gap: 4 });
    if (!section.items.length) {
      write(section.empty, { size: 10, style: "italic", gap: 8 });
      continue;
    }
    for (const item of section.items) {
      ensure(30);
      write(item.title, { size: 10.5, style: "bold", gap: 2 });
      for (const line of item.lines) write(line, { size: 9.5, indent: 10, gap: 1 });
      if (item.flag) write(item.flag, { size: 8.5, style: "bold", color: warn, indent: 10 });
      y += 8;
    }
  }

  ensure(60);
  pdf.setDrawColor(...gold);
  pdf.line(M, y, W - M, y);
  y += 10;
  write("Source and authority limits", { size: 13, font: "times", style: "bold", color: forest, gap: 4 });
  for (const limit of doc.limits) write("• " + limit, { size: 9, gap: 2 });

  // Footer on every page
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...forest);
    pdf.text(`${doc.reference}  ·  NON-AUTHORIZING  ·  GOVERNING LAW IS THE AUTHORITY`, M, H - 30);
    pdf.text(`Page ${p} of ${pages}`, W - M, H - 30, { align: "right" });
  }

  pdf.save(doc.filename);
}
