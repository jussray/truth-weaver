import { expect, test } from "@playwright/test";

test("Philadelphia eviction notice guide is publicly reachable with statutory citations", async ({ page }) => {
  await page.goto("/guides/philadelphia-eviction-notice", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Philadelphia Eviction Notice Requirements/i, level: 1 })).toBeVisible();
  await expect(page.getByText(/68 P.S. § 250.501/i).first()).toBeVisible();
  await expect(page.getByText(/Phila. Code § 9-804/i).first()).toBeVisible();
  await expect(page.getByText(/Eviction Diversion Program/i).first()).toBeVisible();
  await expect(page.getByText(/Certificate of Rental Suitability/i).first()).toBeVisible();
});

test("signup page displays both form and LovableSignInButton", async ({ page }) => {
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Create account/i, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Lovable/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create account/i })).toBeVisible();
});

test("dashboard leads route requires authenticated user and redirects to login", async ({ page }) => {
  await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
});
