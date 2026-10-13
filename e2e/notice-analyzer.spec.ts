import { expect, test } from "@playwright/test";

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
  await expect(page.getByText(/Image-only scans and photos need OCR/i)).toBeVisible();

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

function textPdf(message: string): Buffer {
  const stream = `BT /F1 12 Tf 40 700 Td (${message}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

test("extracts a real text PDF before analysis, without sending or inventing legal conclusions", async ({ page }) => {
  await page.goto("/notice-analyzer");
  await page.locator('input[type="file"]').setInputFiles({
    name: "notice.pdf",
    mimeType: "application/pdf",
    buffer: textPdf("NOTICE RECEIVED OCTOBER 20 2026 PLEASE RESPOND BY NOVEMBER 1 2026"),
  });
  await expect(page.getByTestId("notice-text")).toHaveValue(/NOTICE RECEIVED OCTOBER 20 2026/, { timeout: 20000 });
  await expect(page.getByText(/Loaded notice.pdf/)).toBeVisible();
  await expect(page.getByTestId("analysis-result")).toHaveCount(0);
});

test("image-only PDF does not pretend to have been transcribed", async ({ page }) => {
  await page.goto("/notice-analyzer");
  await page.locator('input[type="file"]').setInputFiles({
    name: "blank.pdf",
    mimeType: "application/pdf",
    buffer: textPdf(""),
  });
  await expect(page.getByText(/No sufficient selectable text found/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("notice-text")).toHaveValue("");
});
