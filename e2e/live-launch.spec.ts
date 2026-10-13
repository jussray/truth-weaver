import { expect, test } from "@playwright/test";

const liveUrl = process.env.TRUTH_WEAVER_LIVE_URL;
const permittedHosts = new Set([
  "truthweaver.jussco.company",
  "fcr-truth-weaver.lovable.app",
]);

test.describe("Truth Weaver live domain (read-only)", () => {
  test.skip(!liveUrl, "Set TRUTH_WEAVER_LIVE_URL to run the deployed-site checks.");

  test("loads the public homepage through the approved domain", async ({ page }) => {
    await page.goto(new URL("/", liveUrl).href, { waitUntil: "domcontentloaded" });
    expect(permittedHosts.has(new URL(page.url()).hostname)).toBe(true);
    await expect(page.getByRole("heading", { name: /Understand the law/i, level: 1 })).toBeVisible();
    await expect(page.getByTestId("triage-input")).toBeVisible();
  });

  test("serves the real Shop page and reports the catalog truthfully", async ({ page }) => {
    await page.goto(new URL("/shop", liveUrl).href, { waitUntil: "domcontentloaded" });
    expect(permittedHosts.has(new URL(page.url()).hostname)).toBe(true);
    await expect(page.getByRole("heading", { name: "The Counsel Store" })).toBeVisible();
    const catalog = page.locator("[data-product-grid], [data-shop-unavailable]");
    await expect(catalog).toBeVisible({ timeout: 30_000 });
    if (await page.locator("[data-shop-unavailable]").isVisible()) {
      // An empty catalog is acceptable before launch; a failed API is not.
      await expect(page.locator("[data-shop-unavailable]")).toContainText("No products found");
    }
  });

  test("serves Notice Analyzer with a usable input, without submitting private data", async ({ page }) => {
    await page.goto(new URL("/notice-analyzer", liveUrl).href, { waitUntil: "domcontentloaded" });
    expect(permittedHosts.has(new URL(page.url()).hostname)).toBe(true);
    await expect(page.getByTestId("notice-analyzer-form")).toBeVisible();
    await page.getByTestId("notice-text").fill(
      "Example notice for browser verification only. No real legal information or private details are included.",
    );
    await expect(page.getByTestId("notice-text")).toHaveValue(/Example notice for browser verification/);
    await expect(page.getByTestId("analyze-notice")).toBeEnabled();
  });
});
