import { expect, test } from "@playwright/test";

test("home leads to free research, keeps Shop and all eleven areas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Understand the Law/ })).toBeVisible();
  await expect(page.locator("#top")).not.toContainText(/source-aware|jurisdiction-aware|instant digital access/i);
  await expect(page.locator("[data-legal-areas] article")).toHaveCount(11);
  await page.getByRole("link", { name: "Start Free Legal Research", exact: true }).click();
  await expect(page).toHaveURL(/#legal-research$/);
  await expect(page.getByTestId("legal-question")).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop Legal Tools", exact: true }).first()).toHaveAttribute("href", "/shop");
});

test("notice uses unnumbered sections and explicit sending consent", async ({ page }) => {
  await page.goto("/notice-analyzer");
  for (const name of ["Where did this notice come from?", "About your document", "Add the notice"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/they do not stay only on your device/)).toBeVisible();
  await expect(page.getByText(/Scans below 85% estimated clarity are rejected/)).toBeVisible();
  await expect(page.getByTestId("notice-consent")).not.toBeChecked();
  await expect(page.getByTestId("analyze-notice")).toBeDisabled();
  await expect(page.getByTestId("analysis-result")).toHaveCount(0);
});