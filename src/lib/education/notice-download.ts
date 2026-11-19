import {
  LEARNING_RESEARCH_WORKFLOW,
  learningResourceMarkdown,
  learningWorkflowJson,
  type LearningKey,
} from "./notice-learning";

type ExportFormat = "pdf" | "markdown";
const MIME_MARKDOWN = "text/markdown;charset=utf-8";

function downloadLocal(filename: string, value: Blob) {
  const url = URL.createObjectURL(value);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Wait for the browser to capture the URL before releasing the Blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function exportEducationWorkflow() {
  const json = learningWorkflowJson();
  downloadLocal("truthweaver-education-review-workflow-v1.json", new Blob([json], { type: "application/json;charset=utf-8" }));
}

/** All exports are educational samples. They neither grant paid access nor publish to providers. */
export async function exportEducationResource(key: LearningKey, format: ExportFormat) {
  const content = learningResourceMarkdown(key);
  const name = `truthweaver-notice-${key}-educational-sample`;
  if (format === "markdown") {
    downloadLocal(`${name}.md`, new Blob([content], { type: MIME_MARKDOWN }));
    return;
  }

  // Keep PDF generation local to the user's browser; do not send notice data to a provider.
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ format: "letter", unit: "pt" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const bottom = height - 58;
  const lineWidth = width - margin * 2;
  let y = 66;

  const decoratePage = () => {
    pdf.setFillColor(16, 40, 32);
    pdf.rect(0, 0, width, 36, "F");
    pdf.setTextColor(196, 160, 82);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("TRUTH WEAVER COUNSEL  /  EDUCATIONAL SAMPLE", margin, 23);
    pdf.setTextColor(92, 96, 102);
    pdf.setFontSize(8);
    pdf.text("Not legal advice  |  Not a purchased report  |  Jurisdiction not verified", margin, height - 28);
  };
  decoratePage();
  const write = (text: string, fontSize: number, bold: boolean, gap: number) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(bold ? 16 : 32, bold ? 40 : 38, bold ? 32 : 42);
    // Helvetica's built-in font is WinAnsi, not Unicode.
    const safe = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, "-");
    const lines = pdf.splitTextToSize(safe, lineWidth) as string[];
    for (const line of lines) {
      if (y + fontSize * 1.4 > bottom) {
        pdf.addPage();
        decoratePage();
        y = 58;
      }
      pdf.text(line, margin, y);
      y += fontSize * 1.42;
    }
    y += gap;
  };

  for (const line of content.split("\n")) {
    if (line.startsWith("# ")) write(line.slice(2), 18, true, 14);
    else if (line.startsWith("## ")) write(line.slice(3), 13, true, 9);
    else if (line.startsWith("- ")) write(line.slice(2), 9, false, 3);
    else if (line.trim()) write(line, 10, false, 7);
    else y += 5;
  }
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setTextColor(92, 96, 102);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`${page} / ${pageCount}`, width - margin, height - 28, { align: "right" });
  }
  pdf.save(`${name}.pdf`);
}

/** A status constant, not an active Cloudflare/GitBook/Exa connection. */
export const EDUCATION_EXPORT_POLICY = LEARNING_RESEARCH_WORKFLOW.gates;
