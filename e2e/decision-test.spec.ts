import { expect, test } from "@playwright/test";

test("decision stress-test produces a non-authorizing bounded receipt", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator('[data-fcr-module="truth-weaver"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: /Understand the law/i })).toBeVisible();

  const values = {
    decision: "Publish a legal claim as current law",
    evidence: "Official statute text located for the named jurisdiction",
    inference: "The statute applies unchanged to this exact situation",
    challenge: "The statute may be amended, superseded, or subject to an exception",
    boundedTest: "Check the current official source and one contrary-authority search before relying on the claim",
    successCondition: "Current official text and jurisdiction-specific authority support the same rule",
    stopCondition: "Stop if currentness, jurisdiction, authenticity, or contrary authority remains unresolved",
  };

  for (const [field, value] of Object.entries(values)) {
    await page.locator(`textarea[name="${field}"]`).fill(value);
  }

  await page.locator("[data-generate-receipt]").click();
  const receipt = page.locator("[data-completion-receipt]");
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText(values.boundedTest);
  await expect(receipt).toContainText(values.successCondition);
  await expect(receipt).toContainText(values.stopCondition);
  await expect(receipt).toContainText("non-authorizing");

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
