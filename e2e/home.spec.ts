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
  await expect(page.getByRole("link", { name: "Start Free Legal Research" })).toHaveAttribute("href", "/#legal-research");
  await expect(page.locator("[data-legal-areas] article")).toHaveCount(11);
  await expect(page.getByRole("link", { name: "Research Your Situation" })).toBeVisible();
  await expect(page.getByText(/FCR module/i)).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.goto("/connectors");
  await expect(page.getByRole("heading", { name: "How we check sources" })).toBeVisible();
  await expect(page.getByTestId("operator-diagnostics")).toHaveCount(0);
  await page.goto("/shop");
  // Shopify is live data. The Shop may show actual saleable products or an
  // explicit unavailable/empty state, but should never remain indefinitely loading.
  const shopState = page.locator("[data-shop-unavailable], [data-product-grid]");
  await expect(shopState.first()).toBeVisible({ timeout: 20_000 });
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

  await expect(gate).toHaveAttribute("data-enabled", "false");
  await expect(page.getByTestId("witness-token")).toHaveCount(0);
  await expect(page.getByTestId("run-witness")).toHaveCount(0);
  await expect(page.getByTestId("witness-result")).toHaveCount(0);
  for (const id of ["exa", "notion", "linear", "slack"]) {
    await expect(page.getByTestId(`connector-setup-${id}`)).toHaveCount(0);
  }

  expect(errors).toEqual([]);
});


test("legal issue entry preserves visitor words when continuing to research on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const issue = "My landlord kept my security deposit after I moved.";
  // The input becomes enabled only after hydration has attached stateful handlers.
  await expect(page.getByTestId("triage-input")).toBeEnabled();
  await page.getByTestId("triage-input").fill(issue);
  await expect(page.getByTestId("triage-continue")).toBeVisible();
  await page.getByTestId("triage-continue").click();
  await expect(page.getByTestId("legal-question")).toHaveValue(issue);
  await expect(page.getByTestId("legal-place")).toBeVisible();
  await expect(page).toHaveURL(/#legal-research$/);
});
