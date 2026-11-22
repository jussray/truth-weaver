import { expect, test, type Page } from "@playwright/test";

// Simulated Storefront API responses for the product detail route. No product is
// published, no buyer information is exposed, and no payment is attempted.
const apiUrl =
  "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/api/2026-10/graphql.json";
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type,x-shopify-storefront-access-token",
  "content-type": "application/json",
};

const money = { amount: "15.00", currencyCode: "USD" };
const multiVariantProduct = {
  id: "gid://shopify/Product/test-only-multi-variant",
  title: "Simulated Multi-Variant Product (not for sale)",
  description: "Test fixture. No product is published or charged.",
  handle: "playwright-multi-variant-test-only",
  productType: "guides",
  tags: [],
  priceRange: { minVariantPrice: money },
  images: { edges: [] },
  variants: {
    edges: [
      {
        node: {
          id: "gid://shopify/ProductVariant/test-only-edition-a",
          title: "Edition A",
          price: money,
          availableForSale: true,
          selectedOptions: [{ name: "Edition", value: "A" }],
        },
      },
      {
        node: {
          id: "gid://shopify/ProductVariant/test-only-edition-b",
          title: "Edition B",
          price: money,
          availableForSale: false,
          selectedOptions: [{ name: "Edition", value: "B" }],
        },
      },
    ],
  },
  options: [{ name: "Edition", values: ["A", "B"] }],
};

// Answers only the product-by-handle operation. Any other Storefront operation is
// reported as an explicit error rather than silently answered.
async function mockProductByHandle(page: Page, product: unknown) {
  await page.route(apiUrl, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const body = route.request().postDataJSON() as { query: string };
    if (!body.query.includes("product(handle:")) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        body: JSON.stringify({ errors: [{ message: "Unexpected mock Shopify operation" }] }),
      });
      return;
    }
    await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify({ data: { product } }) });
  });
}

// The first load of a route can include a cold dev-server compile, so the page-load budget is explicit.
const pageLoad = { timeout: 15_000 };

test("the product option selector has an accessible name", async ({ page }) => {
  await mockProductByHandle(page, multiVariantProduct);
  await page.goto(`/product/${multiVariantProduct.handle}`);
  await expect(page.getByRole("heading", { level: 1, name: multiVariantProduct.title })).toBeVisible(pageLoad);
  const selector = page.getByRole("combobox", { name: "Product option" });
  await expect(selector).toBeVisible();
  await expect(selector.locator("option")).toHaveCount(2);
  await expect(selector).toHaveValue("0");
});

test("a product that is not found shows a page heading and a way back to the shop", async ({ page }) => {
  await mockProductByHandle(page, null);
  await page.goto("/product/playwright-missing-test-only");
  await expect(page.getByRole("heading", { level: 1, name: "Product not found", exact: true })).toBeVisible(pageLoad);
  await expect(page.getByRole("link", { name: "Back to shop" })).toHaveAttribute("href", "/shop");
});

test("a Storefront failure shows the same heading after the query gives up", async ({ page }) => {
  await page.route(apiUrl, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 500,
      headers: corsHeaders,
      body: JSON.stringify({ errors: [{ message: "Store unavailable in test" }] }),
    });
  });
  await page.goto("/product/playwright-unreachable-test-only");
  // The app's QueryClient retries failed queries before it reports the error, so allow for that.
  await expect(page.getByRole("heading", { level: 1, name: "Product not found", exact: true })).toBeVisible({
    timeout: 20_000,
  });
});
