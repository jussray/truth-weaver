import { expect, test } from "@playwright/test";

// No provider stubs are needed: public learning resources are local, static,
// versioned educational material, never a paid order or a legal determination.
test("guide, templates, course and bundle samples render without purchase controls", async ({ page }) => {
  const examples = [
    { key: "guide", container: "learning-guide", text: "Separate stated dates from verified deadlines" },
    { key: "templates", container: "learning-templates", text: "Lawyer or legal-aid intake sheet" },
    { key: "course", container: "learning-course", text: "Read the document without jumping to conclusions" },
    { key: "bundle", container: "learning-guide", text: "Notice Snapshot is a separately verified" },
  ] as const;
  for (const item of examples) {
    await page.goto(`/learn?resource=${item.key}`);
    await expect(page.getByTestId("learning-safety")).toContainText("NOT LEGAL ADVICE");
    await expect(page.getByTestId(item.container)).toContainText(item.text);
    await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Checkout" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  }
  await expect(page.getByTestId("learning-course").getByTestId("learning-lesson")).toHaveCount(5);
});

test("PDF, GitBook Markdown and workflow exports are user-initiated downloads", async ({ page }) => {
  await page.goto("/learn?resource=course");
  const mdPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown" }).click();
  const markdown = await mdPromise;
  expect(markdown.suggestedFilename()).toBe("truthweaver-notice-course-educational-sample.md");

  const jsonPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export review workflow JSON" }).click();
  const json = await jsonPromise;
  expect(json.suggestedFilename()).toBe("truthweaver-education-review-workflow-v1.json");

  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sample PDF" }).click();
  const pdf = await pdfPromise;
  expect(pdf.suggestedFilename()).toBe("truthweaver-notice-course-educational-sample.pdf");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("course answers start hidden and are revealable without submitting personal data", async ({ page }) => {
  await page.goto("/learn?resource=course");
  const first = page.getByTestId("learning-lesson").first();
  await expect(first.getByText("No. It is an assertion that needs")).not.toBeVisible();
  await first.locator("summary").click();
  await expect(first.getByText("No. It is an assertion that needs")).toBeVisible();
});
