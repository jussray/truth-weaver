import { expect, test } from "@playwright/test";

test("public storefront homepage renders the cinematic legal storefront", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/");
  await expect(page.getByText(/Knowledge changes lives/i)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Understand the Law/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop Legal Tools" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore by Legal Area" })).toBeVisible();
  await expect(page.locator("[data-legal-areas] article")).toHaveCount(11);
  await expect(page.getByRole("link", { name: /Start Building a Fairer Tomorrow/ })).toBeVisible();
  await expect(page.getByText(/FCR module/i)).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.goto("/connectors");
  await expect(page.locator('[data-connector="muse"] [data-connector-status]')).toHaveText("Not configured");
  await page.goto("/shop");
  await expect(page.locator("[data-shop-unavailable]")).toBeVisible();
  expect(errors).toEqual([]);
});
