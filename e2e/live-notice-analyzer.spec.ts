import { expect, test } from "@playwright/test";

const SAMPLE_NOTICE =
  "NOTICE OF HEARING. A hearing is scheduled for November 12, 2026 at 10:00 AM. " +
  "The recipient must file a written response within 14 days of receipt. " +
  "Issued by Example Administrative Office. This is a fictional notice used only for automated verification.";

const DATE_PATTERN = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\b/g;
const LEGAL_CITATION_PATTERN = /\b\d+\s+(?:U\.?S\.?C\.?|C\.?F\.?R\.?)\b/i;

test.skip(!process.env.LIVE_BASE_URL, "live runtime witness requires LIVE_BASE_URL");

test("deployed notice analyzer reaches the real server AI path and stays source-bound", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const sameOriginPosts: Array<{ url: string; status: number }> = [];
  const baseURL = new URL(testInfo.project.use.baseURL as string);

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    const request = response.request();
    if (request.method() !== "POST") return;
    const responseURL = new URL(response.url());
    if (responseURL.origin === baseURL.origin) {
      sameOriginPosts.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto("/notice-analyzer", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1, name: /Pull the signal out of a legal notice/i })).toBeVisible();
  await expect(page.getByTestId("notice-authority")).toContainText("NON-AUTHORIZING");
  await expect(page.getByTestId("notice-authority")).toContainText("GOVERNING LAW IS THE AUTHORITY");

  await page.getByTestId("jurisdiction-type").selectOption("federal");
  await page.getByLabel("Document title").fill("Fictional Notice of Hearing");
  await page.getByLabel("Document type").fill("Hearing notice");
  await page.getByLabel("Issuer / sender").fill("Example Administrative Office");
  await page.getByTestId("notice-text").fill(SAMPLE_NOTICE);

  await page.getByTestId("analyze-notice").click();

  const result = page.getByTestId("analysis-result");
  await expect(result).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("analysis-error")).toHaveCount(0);

  const resultText = (await result.innerText()).trim();
  await testInfo.attach("live-notice-analyzer-result.txt", {
    body: resultText,
    contentType: "text/plain",
  });
  await page.screenshot({ path: testInfo.outputPath("live-notice-analyzer.png"), fullPage: true });

  await expect(result).toContainText("November 12, 2026");
  await expect(result).toContainText(/14 days/i);
  await expect(result.getByText("Critical dates & deadlines")).toBeVisible();
  await expect(result.getByText("Obligations & demanded actions")).toBeVisible();
  await expect(result.getByText("Questions for counsel")).toBeVisible();
  await expect(result.getByText("Uncertainties & verification gaps")).toBeVisible();

  expect(LEGAL_CITATION_PATTERN.test(resultText)).toBe(false);
  const absoluteDates = resultText.match(DATE_PATTERN) ?? [];
  expect(new Set(absoluteDates)).toEqual(new Set(["November 12, 2026"]));

  expect(sameOriginPosts.some(({ status }) => status >= 200 && status < 300)).toBe(true);
  expect(errors).toEqual([]);

  console.log("LIVE_NOTICE_ANALYZER_POSTS", JSON.stringify(sameOriginPosts));
  console.log("LIVE_NOTICE_ANALYZER_RESULT", JSON.stringify(resultText));
});
