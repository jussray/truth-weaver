import { expect, test } from "@playwright/test";

// Public browser test only. It never authenticates as merchant, creates an
// order, calls a Shopify Admin mutation, or submits a payment.
test("merchant management is closed to unsigned visitors", async ({ page }) => {
  await page.goto("/merchant", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
});

test("merchant management and existing product routes remain private", async ({ page }) => {
  for (const path of ["/merchant/manage", "/merchant/products"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  }
});
