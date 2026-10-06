import { expect, test } from "@playwright/test";

test("legal navigator fails closed when the jurisdiction is too broad", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator('[data-fcr-module="truth-weaver"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: /Understand the law/i, level: 1 })).toBeVisible();
  await expect(page.locator("[data-legal-navigator]")).toBeVisible();
  await expect(page.locator("[data-external-tester-loop]")).toHaveCount(0);

  await page.getByTestId("legal-question").fill("Rent to own");
  await page.getByTestId("legal-place").fill("Africa");
  await page.getByTestId("research-law").click();

  const result = page.getByTestId("legal-research-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("JURISDICTION UNKNOWN");
  await expect(result).toContainText(/too broad|country/i);
  await expect(result).toContainText("EVIDENCE_ONLY");

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
