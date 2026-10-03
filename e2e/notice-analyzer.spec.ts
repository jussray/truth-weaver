import { expect, test } from "@playwright/test";

function minimalPdf(text: string) {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT\n/F1 18 Tf\n72 720 Td\n(${escaped}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let index = 1; index <= 5; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}

test("legal notice analyzer is source-bound and does not fabricate a result before server success", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/notice-analyzer");

  await expect(page.getByRole("heading", { level: 1, name: /Pull the signal out of a legal notice/i })).toBeVisible();
  await expect(page.getByTestId("notice-authority")).toContainText("NON-AUTHORIZING");
  await expect(page.getByTestId("notice-authority")).toContainText("GOVERNING LAW IS THE AUTHORITY");
  await expect(page.getByText(/Text PDFs are extracted in your browser/i)).toBeVisible();

  await page.getByTestId("jurisdiction-type").selectOption("state");
  await page.getByTestId("jurisdiction-detail").fill("Pennsylvania");
  await page.getByTestId("notice-text").fill(
    "Sample notice for automated testing only. A written response is requested by October 20, 2026. Contact the sender with any questions about the stated request.",
  );

  await expect(page.getByTestId("analyze-notice")).toBeEnabled();
  await expect(page.getByTestId("analysis-empty")).toBeVisible();
  await expect(page.getByTestId("analysis-result")).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("text PDF upload extracts visible text with source and page provenance", async ({ page }) => {
  await page.goto("/notice-analyzer");

  await page.getByTestId("notice-document-file").setInputFiles({
    name: "sample-hearing-notice.pdf",
    mimeType: "application/pdf",
    buffer: minimalPdf("NOTICE OF HEARING NOVEMBER 12 2026 WRITTEN RESPONSE REQUIRED"),
  });

  await expect(page.getByTestId("file-message")).toContainText("Extracted 1 page");
  await expect(page.getByTestId("notice-text")).toHaveValue(/\[SOURCE: sample-hearing-notice\.pdf \| PAGE 1\]/);
  await expect(page.getByTestId("notice-text")).toHaveValue(/NOTICE OF HEARING NOVEMBER 12 2026 WRITTEN RESPONSE REQUIRED/);
  await expect(page.getByTestId("analysis-result")).toHaveCount(0);
});
