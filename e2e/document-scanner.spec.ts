import { expect, test } from "@playwright/test";

/** Privacy boundary: page capture is local until reviewed text is submitted separately. */
test("document scanner captures a page locally and never submits a notice automatically", async ({ page }) => {
  let analysisRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /notice-analyzer|analyzeLegalNotice/.test(request.url())) analysisRequests++;
  });
  await page.goto("/notice-analyzer");
  await expect(page.getByTestId("open-document-scanner")).toBeVisible();
  await page.getByTestId("open-document-scanner").click();
  await expect(page.getByTestId("document-scanner-dialog")).toBeVisible();

  // Minimal valid 1x1 PNG is adequate for preview/selection, not OCR.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
  await page.getByTestId("scanner-photo-input").setInputFiles({
    name: "page-one.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByTestId("scanner-page")).toHaveCount(1);
  await expect(page.getByTestId("scanner-read-pages")).toBeEnabled();
  await page.getByRole("button", { name: "Rotate" }).click();
  await page.getByRole("slider", { name: "Trim edges of page 1" }).focus();
  await page.getByRole("slider", { name: "Trim edges of page 1" }).press("ArrowRight");
  expect(await page.evaluate(() => (document.querySelector('[data-testid="notice-text"]') as HTMLTextAreaElement)?.value ?? "")).toBe("");
  expect(await page.evaluate(() => (document.querySelector('[data-testid="notice-consent"]') as HTMLInputElement)?.checked ?? false)).toBe(false);
  expect(analysisRequests).toBe(0);

  await page.getByTestId("scanner-discard-scans").click();
  await expect(page.getByTestId("document-scanner-dialog")).toHaveCount(0);
  await expect(page.getByTestId("notice-text")).toHaveValue("");
  await page.getByTestId("open-document-scanner").click();
  await expect(page.getByTestId("scanner-page")).toHaveCount(0);
  expect(analysisRequests).toBe(0);
});

test("document scanner saves a two-page PDF locally without submitting legal content", async ({ page }) => {
  let analysisCalls = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /analyzeLegalNotice|notice-analyzer/.test(request.url())) analysisCalls++;
  });
  await page.goto("/notice-analyzer");
  await page.getByTestId("open-document-scanner").click();
  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 250;
    canvas.height = 350;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, 250, 350);
    ctx.fillStyle = "#f7f7f7";
    ctx.fillRect(25, 25, 200, 300);
    ctx.fillStyle = "#151515";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("SAMPLE NOTICE", 35, 75);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await page.getByTestId("scanner-pages-input").setInputFiles([
    { name: "page-one.png", mimeType: "image/png", buffer: Buffer.from(pngBase64, "base64") },
    { name: "page-two.png", mimeType: "image/png", buffer: Buffer.from(pngBase64, "base64") },
  ]);
  await expect(page.getByTestId("scanner-page")).toHaveCount(2);
  await page.getByRole("button", { name: "Suggest edges for page 1" }).click();
  await expect(page.getByTestId("scanner-save-pdf")).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("scanner-save-pdf").click(),
  ]);
  expect(download.suggestedFilename()).toBe("truth-weaver-scanned-document.pdf");
  expect(await page.evaluate(() => (document.querySelector('[data-testid="notice-text"]') as HTMLTextAreaElement)?.value ?? "")).toBe("");
  expect(await page.evaluate(() => (document.querySelector('[data-testid="notice-consent"]') as HTMLInputElement)?.checked ?? false)).toBe(false);
  expect(analysisCalls).toBe(0);
});


test("camera media tracks are stopped if preview playback fails", async ({ page }) => {
  await page.addInitScript(() => {
    const observed = window as Window & { __scannerTrackStops?: number };
    observed.__scannerTrackStops = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 10;
          canvas.height = 10;
          const stream = canvas.captureStream(1);
          for (const track of stream.getTracks()) {
            const originalStop = track.stop.bind(track);
            track.stop = () => {
              observed.__scannerTrackStops = (observed.__scannerTrackStops || 0) + 1;
              originalStop();
            };
          }
          return stream;
        },
      },
    });
    // Permission can succeed while playback is blocked by a platform policy.
    HTMLMediaElement.prototype.play = () => Promise.reject(new Error("playback blocked"));
  });
  await page.goto("/notice-analyzer");
  await page.getByTestId("open-document-scanner").click();
  await expect(page.getByRole("status").filter({ hasText: /preview is unavailable/i })).toBeVisible();
  await expect.poll(async () => page.evaluate(
    () => (window as Window & { __scannerTrackStops?: number }).__scannerTrackStops ?? 0
  )).toBeGreaterThan(0);
  // The manual picker is still usable when a camera preview is rejected.
  await expect(page.getByTestId("scanner-pages-input")).toBeEnabled();
});
