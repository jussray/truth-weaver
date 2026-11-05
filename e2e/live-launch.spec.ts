import { expect, test } from "@playwright/test";

const liveUrl = process.env.TRUTH_WEAVER_LIVE_URL;
const requireCatalog = process.env.TRUTH_WEAVER_REQUIRE_CATALOG === "true";
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
    if (requireCatalog) {
      // Explicit release-readiness mode: an empty or unavailable catalog cannot pass.
      const grid = page.locator("[data-product-grid]");
      await expect(grid).toBeVisible({ timeout: 30_000 });
      await expect(grid.locator(":scope > *").first()).toBeVisible();
      await expect(page.locator("[data-shop-unavailable]")).toHaveCount(0);
      return;
    }
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
    // SSR markup is inert until the real React input handlers hydrate. Wait for that
    // user-facing readiness signal instead of racing the initial client render.
    await expect(page.locator('input[type="file"]')).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId("notice-text").fill(
      "Example notice for browser verification only. No real legal information or private details are included.",
    );
    await expect(page.getByTestId("notice-text")).toHaveValue(/Example notice for browser verification/);
    // Deployed source may lag GitHub's main. This is a read-only live smoke
    // test; the new consent/date validation is asserted against local head.
    await expect(page.getByTestId("analyze-notice")).toBeVisible();
  });
});
