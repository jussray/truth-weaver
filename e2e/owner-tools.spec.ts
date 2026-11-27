import { expect, test } from "@playwright/test";

test("private owner tools deny anonymous visitors before exposing any review controls", async ({page}) => {
  await page.goto("/owner-tools");
  await expect(page).toHaveURL(/\/login(?:\?|$)/, {timeout:15_000});
  await expect(page.getByTestId("owner-search-console")).toHaveCount(0);
  await expect(page.getByTestId("owner-evidence-review")).toHaveCount(0);
});

test("public crawler manifest excludes the owner tools route", async ({request}) => {
  const res=await request.get("/robots.txt");
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain("Disallow: /owner-tools");
});
