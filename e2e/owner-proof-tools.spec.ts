import { expect, test } from "@playwright/test";

test("Search Console owner metrics remain private to signed-out visitors", async ({ page }) => {
  await page.goto("/merchant/search-console");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fmerchant%2Fsearch-console/);
  await expect(page.getByTestId("search-console-panel")).toHaveCount(0);
});

test("Claim evidence challenge is not a public submission endpoint", async ({ page }) => {
  await page.goto("/merchant/claim-review");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fmerchant%2Fclaim-review/);
  await expect(page.getByTestId("claim-evidence-review")).toHaveCount(0);
});

test("AI-discovery reference exposes only canonical public site information", async ({ request }) => {
  const r = await request.get("/llms.txt");
  expect(r.ok()).toBe(true);
  const text = await r.text();
  expect(text).toContain("https://truthweaver.jussco.company/sources");
  expect(text).toContain("Public sitemap");
  expect(text).not.toMatch(/private_key|LOVABLE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|sk-proj-/i);
});
