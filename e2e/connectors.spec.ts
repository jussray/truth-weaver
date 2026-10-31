import { expect, test } from "@playwright/test";

test("public Source Center explains checks without exposing operator controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/connectors");
  await expect(page.getByRole("heading", { name: "Where our knowledge comes from." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How we check sources" })).toBeVisible();
  await expect(page.getByText("Coverage is incomplete.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse registered legal sources" })).toHaveAttribute("href", "/sources");
  await expect(page.getByTestId("operator-diagnostics")).toHaveCount(0);
  await expect(page.getByTestId("witness-token")).toHaveCount(0);
  await expect(page.getByTestId("run-witness")).toHaveCount(0);
  await expect(page.locator('[data-testid^="connector-receipt-"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});