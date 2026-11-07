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

  const researchButton = page.getByTestId("research-law");
  await expect(researchButton).toBeEnabled({ timeout: 15_000 });
  await page.getByTestId("legal-question").fill("Rent to own");
  await page.getByTestId("legal-place").fill("Africa");
  await researchButton.click();

  const result = page.getByTestId("legal-research-result");
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.locator('[data-truth-state="JURISDICTION UNKNOWN"]')).toHaveText("Location needs checking");
  await expect(result).toContainText(/too broad|country/i);
  const details = page.getByTestId("research-check-details");
  await expect(details).not.toHaveAttribute("open", "");
  await details.getByText("How this was checked", { exact: true }).click();
  await expect(details).toContainText("EVIDENCE_ONLY");
  await expect(details).toContainText("JURISDICTION UNKNOWN");

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
