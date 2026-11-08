import { expect, test } from "@playwright/test";

// Signed-in runs need MERCHANT_SESSION_JSON + MERCHANT_STORAGE_KEY (a merchant's session).
const session = process.env["MERCHANT_SESSION_JSON"];
const storageKey = process.env["MERCHANT_STORAGE_KEY"];

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/merchant/products");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fmerchant%2Fproducts/);
});

test.describe("merchant price edit", () => {
  test.skip(!session || !storageKey, "merchant session not provided");

  test("edit price, confirmation names the change, activity log records it", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [storageKey, session]);
    await page.goto("/merchant/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

    const store = page.getByRole("alert").filter({ hasText: /store connection/i });
    test.skip(await store.isVisible().catch(() => false), "Shopify store connection is not live");

    const input = page.getByLabel(/^Price for /).first();
    const before = await input.inputValue();
    const next = (Number(before) + 0.01).toFixed(2); // routine raise: one-click
    await input.fill(next);
    await page.getByRole("button", { name: "Review change" }).first().click();
    await expect(page.getByTestId("price-diff")).toContainText(`$${before}`);
    await page.getByRole("button", { name: "Confirm change" }).click();
    await expect(page.getByTestId("price-notice")).toContainText(`from $${before} to $${next}`);

    await page.goto("/merchant/audit-log");
    const row = page.getByTestId("audit-rows").locator('li[data-outcome="succeeded"]').first();
    await expect(row).toContainText("price.update");
    await expect(row).toContainText(`$${before} → $${next}`);

    // Restore the original price (decrease => typed phrase required).
    await page.goto("/merchant/products");
    await page.getByLabel(/^Price for /).first().fill(before);
    await page.getByRole("button", { name: "Review change" }).first().click();
    await page.getByRole("button", { name: "Fill phrase" }).click();
    await page.getByRole("button", { name: "Confirm change" }).click();
    await expect(page.getByTestId("price-notice")).toContainText(`to $${before}`);
  });
});
