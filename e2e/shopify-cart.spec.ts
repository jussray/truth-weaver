import { expect, test, type Page } from "@playwright/test";

// Simulated Storefront API responses exercise the UI/cart integration without
// publishing a product, exposing buyer information, or attempting a payment.
const apiUrl =
  "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/api/2026-10/graphql.json";
const checkoutUrl =
  "https://fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/cn/fixture?key=test-only&locale=en";
const cartId = "gid://shopify/Cart/test-only?key=mock-secret";
const variantId = "gid://shopify/ProductVariant/test-only";
const item = {
  node: {
    id: "gid://shopify/Product/test-only",
    title: "Simulated Playwright Product (not for sale)",
    description: "Test fixture. No product is published or charged.",
    handle: "playwright-test-only",
    productType: "guides",
    tags: [],
    priceRange: { minVariantPrice: { amount: "15.00", currencyCode: "USD" } },
    images: { edges: [] },
    variants: {
      edges: [
        {
          node: {
            id: variantId,
            title: "Default Title",
            price: { amount: "15.00", currencyCode: "USD" },
            availableForSale: true,
            selectedOptions: [],
          },
        },
      ],
    },
    options: [],
  },
};
const cartLines = {
  edges: [
    {
      node: {
        id: "gid://shopify/CartLine/test-only",
        quantity: 1,
        merchandise: {
          id: variantId,
          price: { amount: "15.00", currencyCode: "USD" },
        },
      },
    },
  ],
};

async function mockShopify(page: Page, rejectCart = false) {
  await page.route(apiUrl, async (route) => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type,x-shopify-storefront-access-token",
      "content-type": "application/json",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = route.request().postDataJSON() as {
      query: string;
      variables?: Record<string, unknown>;
    };
    let data: unknown;
    if (body.query.includes("products(")) {
      data = { products: { edges: [item] } };
    } else if (body.query.includes("cartCreate(")) {
      data = {
        cartCreate: rejectCart
          ? { cart: null, userErrors: [{ field: ["input"], message: "Unavailable in test" }] }
          : {
              cart: {
                id: cartId,
                checkoutUrl,
                lines: { edges: [{ node: { id: cartLines.edges[0].node.id, merchandise: { id: variantId } } }] },
              },
              userErrors: [],
            },
      };
    } else if (body.query.includes("cart(id:")) {
      data = {
        cart: {
          id: cartId,
          totalQuantity: 1,
          checkoutUrl,
          lines: cartLines,
        },
      };
    } else {
      throw new Error("Unexpected mock Shopify operation: " + body.query.slice(0, 120));
    }
    await route.fulfill({ status: 200, headers, body: JSON.stringify({ data }) });
  });
}

test("a mocked available product reaches Shopify checkout without mutating its URL", async ({ page }) => {
  await mockShopify(page);
  await page.route("https://fcr-truth-weaver-esimv-203acj81.myshopify.com/checkouts/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Mock Shopify Checkout</title><h1>Mock checkout, no payment</h1>",
    }),
  );
  await page.goto("/shop");
  const product = page.locator("[data-product-card]");
  await expect(product).toHaveCount(1);
  await expect(product.getByText("Simulated Playwright Product (not for sale)").first()).toBeVisible();
  await product.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.locator('[data-testid="cart-button"]:visible').first()).toContainText("1");
  await page.locator('[data-testid="cart-button"]:visible').first().click();
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await page.getByRole("button", { name: "Checkout with Shopify" }).click();
  await expect(page).toHaveURL(checkoutUrl);
  await expect(page.getByRole("heading", { name: "Mock checkout, no payment" })).toBeVisible();
});

test("failed Shopify cart creation never reports a successful add", async ({ page }) => {
  await mockShopify(page, true);
  await page.goto("/shop");
  await expect(page.locator("[data-product-card]")).toHaveCount(1);
  await page.locator("[data-product-card]").getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Couldn't add Simulated Playwright Product (not for sale). Please try again.")).toBeVisible();
  await expect(page.locator('[data-testid="cart-button"]:visible').first()).not.toContainText("1");
});

test("shows planned preview prices without enabling a purchase", async ({ page }) => {
  await page.route(apiUrl, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "application/json",
      },
      body: JSON.stringify({ data: { products: { edges: [] } } }),
    });
  });
  await page.goto("/shop");
  const previews = page.getByTestId("notice-offer-preview");
  await expect(previews).toHaveCount(3);
  await expect(previews.nth(0)).toContainText("$10 planned");
  await expect(previews.nth(1)).toContainText("$29 planned");
  await expect(previews.nth(2)).toContainText("$49 planned");
  await expect(page.getByTestId("notice-offer-previews")).toContainText("Not for sale");
  await expect(page.getByTestId("notice-offer-previews").getByRole("button")).toHaveCount(0);
});
