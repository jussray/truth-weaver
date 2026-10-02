import { expect, test } from "@playwright/test";

test("public storefront homepage renders the cinematic legal storefront", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

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

test("custody witness on connector route fails closed unless the operator gate is explicitly enabled", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/connectors");
  const gate = page.getByTestId("witness-gate");
  await expect(gate).toHaveCount(1);

  const enabled = await gate.getAttribute("data-enabled");
  if (enabled === "true") {
    await expect(page.getByTestId("witness-readiness")).toBeVisible();
    await expect(page.getByTestId("witness-token")).toHaveValue("");
    await expect(page.getByTestId("run-witness")).toBeDisabled();
    await expect(page.getByTestId("witness-run-id")).toHaveText(/[0-9a-f-]{36}/i);
    await expect(page.getByText(/No secret values are exposed/i)).toBeVisible();
  } else {
    await expect(gate).toHaveAttribute("data-enabled", "false");
    await expect(page.getByTestId("witness-token")).toHaveCount(0);
    await expect(page.getByTestId("run-witness")).toHaveCount(0);
    await expect(page.getByTestId("witness-result")).toHaveCount(0);
  }

  expect(errors).toEqual([]);
});
