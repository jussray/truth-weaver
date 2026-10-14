import { expect, test } from "@playwright/test";

test("merchant operations cannot be viewed without a signed-in account", async ({ page }) => {
  await page.goto("/merchant", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  await expect(page.getByTestId("merchant-portal")).toHaveCount(0);
});

// Live product mutations must be tested with a merchant-scoped test session,
// an isolated draft variant, a server-authenticated write, an immutable audit
// receipt, and verified rollback. This test intentionally does not invent
// merchant credentials or simulate a successful product mutation.
