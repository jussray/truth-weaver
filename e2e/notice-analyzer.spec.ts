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
  await expect(page.getByText(/PDF and image extraction are not enabled/i)).toBeVisible();

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
