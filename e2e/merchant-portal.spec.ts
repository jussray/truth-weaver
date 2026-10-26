import { expect, test } from "@playwright/test";

// Signed-in runs need MERCHANT_SESSION_JSON + MERCHANT_STORAGE_KEY (a merchant's session).
const session = process.env["MERCHANT_SESSION_JSON"];
const storageKey = process.env["MERCHANT_STORAGE_KEY"];

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/merchant/products");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fmerchant%2Fproducts/);
});

// Destructive live test: never run merely because merchant login is configured.
// A named target and explicit opt-in are required, and the original price is
// restored in a finally block even if a readback or audit assertion fails.
const liveVariantId = process.env["MERCHANT_LIVE_TEST_VARIANT_GID"];
const liveTestEnabled = process.env["MERCHANT_ALLOW_LIVE_PRICE_TEST"] === "yes";

test.describe("merchant price edit (opt-in live round-trip)", () => {
  test.skip(!session || !storageKey || !liveVariantId || !liveTestEnabled, "Requires merchant login, an exact variant GID and explicit live-price test opt-in");

  test("writes a real variant, re-reads the catalog and restores its original price", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [storageKey, session]);
    await page.goto("/merchant/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();

    const store = page.getByRole("alert").filter({ hasText: /store connection/i });
    test.skip(await store.isVisible().catch(() => false), "Shopify store connection is not live");

    const input = page.locator(`li[data-variant-id="${liveVariantId}"] input[aria-label^="Price for "]`);
    await expect(input).toBeVisible();
    const before = await input.inputValue();
    const next = (Number(before) + 0.01).toFixed(2);

    try {
      await input.fill(next);
      await page.getByRole("button", { name: "Review change" }).first().click();
      await expect(page.getByTestId("price-diff")).toContainText(`$${before}`);
      await page.getByRole("button", { name: "Confirm change" }).click();
      await expect(page.getByTestId("price-notice")).toContainText(`from $${before} to $${next}`);

      // A fresh merchant read is independent from the write response.
      await page.reload();
      await expect(input).toHaveValue(next);

      await page.goto("/merchant/audit-log");
      const row = page.getByTestId("audit-rows").locator('li[data-outcome="succeeded"]').first();
      await expect(row).toContainText("price.update");
      await expect(row).toContainText(`$${before} → $${next}`);
    } finally {
      // Restore even when the mutation response was lost after Shopify accepted
      // the write. The page must re-read the actual current variant price.
      await page.goto("/merchant/products");
      await expect(input).toBeVisible();
      const actual = await input.inputValue();
      if (actual !== before) {
        await input.fill(before);
        await page.getByRole("button", { name: "Review change" }).first().click();
        await page.getByRole("button", { name: "Fill phrase" }).click();
        await page.getByRole("button", { name: "Confirm change" }).click();
        await expect(page.getByTestId("price-notice")).toContainText(`to $${before}`);
        await page.reload();
        await expect(input).toHaveValue(before);
      }
    }
  });
});
