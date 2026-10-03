import { expect, test } from "@playwright/test";

test("connector source center fails closed and exposes proof for any green state", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/connectors");
  await expect(page.getByRole("heading", { name: "Where our knowledge comes from." })).toBeVisible();

  await expect(page.locator('[data-connector-status="connecting"]')).toHaveCount(0, { timeout: 15_000 });

  const publicWeb = page.locator('article[data-connector="web"]');
  await expect(publicWeb.locator('[data-connector-status="available"]')).toBeVisible();

  for (const provider of ["openai", "gemini"]) {
    const card = page.locator(`article[data-connector="${provider}"]`);
    await expect(card.locator('[data-connector-status="connected"]')).toHaveCount(0);
  }

  const github = page.locator('article[data-connector="github"]');
  await expect(github).toContainText("Code is not governing legal authority.");
  await expect(github).not.toContainText("Code is never legal evidence.");

  const connected = page.locator('article:has([data-connector-status="connected"])');
  const count = await connected.count();
  for (let index = 0; index < count; index += 1) {
    const card = connected.nth(index);
    await card.getByText("Connection proof").click();
    await expect(card.getByText("Last success:")).toBeVisible();
    await expect(card.locator('[data-testid^="connector-receipt-"]')).toContainText(/Receipt: sha256:[a-f0-9]{64}/);
    await expect(card).not.toContainText("configuration_only");
  }

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
