import { expect, test } from "@playwright/test";

// Real route smoke tests against the running TanStack app. No mocked users,
// fake purchases, private legal narratives, or provider-success claims.
test("source registry and legal library are reachable on mobile and desktop", async ({ page }) => {
  await page.goto("/sources", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Source registry", level: 1 })).toBeVisible();
  await expect(page.getByText(/not exhaustive coverage/i).first()).toBeVisible();

  await page.goto("/legal-library", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Legal library/i, level: 1 })).toBeVisible();
});

test("account and recovery screens exist without logging anyone in", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Create account|Sign up/i, level: 1 })).toBeVisible();

  await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /reset|forgot|recover/i, level: 1 })).toBeVisible();
});

test("dashboard requires an authenticated user", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
});

test("navigation surfaces the customer workspace and public sources", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const sourceLinks = page.locator('a[href="/sources"]');
  const workspaceLinks = page.locator('a[href="/dashboard"]');
  await expect(sourceLinks.first()).toBeAttached();
  await expect(workspaceLinks.first()).toBeAttached();
});
