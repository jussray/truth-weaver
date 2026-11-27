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

async function mockShopify(page: Page, rejectCart = false, products = [item]) {
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
      data = { products: { edges: products } };
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
  await expect(product).toHaveCount(1, { timeout: 15_000 });
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
    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({ data: { products: { edges: [] } } }),
    });
  });
  await page.goto("/shop");
  // Cold local Vite runs hydrate the route and its query after the first paint.
  await expect(page.locator("[data-shop-unavailable]")).toContainText(/No products found|No publicly available Shopify products yet/, { timeout: 15_000 });
  const previews = page.getByTestId("notice-offer-preview");
  await expect(previews).toHaveCount(3);
  await expect(previews.nth(0)).toContainText("$10 planned");
  await expect(previews.nth(1)).toContainText("$29 planned");
  await expect(previews.nth(2)).toContainText("$49 planned");
  await expect(page.getByTestId("notice-offer-previews")).toContainText("Not for sale");
  await expect(page.getByTestId("notice-offer-previews").getByRole("button")).toHaveCount(0);
});

test("Shopify connection errors do not impersonate an empty published catalog", async ({ page }) => {
  await page.route(apiUrl, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type,x-shopify-storefront-access-token",
        },
      });
    } else {
      await route.fulfill({
        status: 402,
        headers: {
          "access-control-allow-origin": "*",
          "content-type": "application/json",
        },
        body: JSON.stringify({ errors: [{ message: "Store unavailable in test" }] }),
      });
    }
  });
  await page.goto("/shop");
  await expect(page.locator("[data-shop-unavailable]")).toContainText(/Shopify's catalog connection could not be verified|The store couldn't be reached right now/);
});

test("shows matching draft resource previews without purchase controls", async ({ page }) => {
  await page.route(apiUrl, async (route) => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type,x-shopify-storefront-access-token",
      "content-type": "application/json",
    };
    await route.fulfill(route.request().method() === "OPTIONS"
      ? { status: 204, headers }
      : { status: 200, headers, json: { data: { products: { edges: [] } } } });
  });
  await page.goto("/shop");
  const previews = page.getByTestId("prepared-resource-preview");
  await expect(previews).toHaveCount(4);
  await expect(previews.first()).toContainText("Notice Response Guide");
  await expect(previews.first()).toContainText("Not for sale");
  await expect(page.getByTestId("prepared-resource-previews").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("prepared-resource-previews").getByRole("link")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Store categories" }).getByRole("link", { name: "Courses" }).click();
  await expect(previews).toHaveCount(1);
  await expect(previews.first()).toContainText("Notice Basics Course");
  await page.goto("/shop?category=courses&area=housing");
  await expect(page.locator("[data-shop-unavailable]")).toBeVisible();
  await expect(previews).toHaveCount(0);
});

test("held Shopify products coexist with unmatched previews without duplicate identities", async ({ page }) => {
  const heldProduct = (title: string, handle: string, id: string) => ({
    node: { ...item.node, id: "gid://shopify/Product/" + id, title, handle, tags: ["launch-hold"] },
  });
  await mockShopify(page, false, [
    heldProduct("Notice Snapshot", "truth-weaver-notice-analyzer", "1"),
    heldProduct("Notice Deep Dive", "truth-weaver-notice-deep-dive-interactive-analysis", "2"),
    heldProduct("Notice Premium", "truth-weaver-notice-premium-research-packet", "3"),
  ]);
  await page.goto("/shop");
  await expect(page.locator("[data-product-card]")).toHaveCount(3);
  await expect(page.getByTestId("notice-offer-preview")).toHaveCount(0);
  await expect(page.getByTestId("prepared-resource-preview")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
});

test("an existing resource suppresses only its own preview; area searches suppress all previews", async ({ page }) => {
  await mockShopify(page, false, [{
    node: { ...item.node, handle: "truth-weaver-notice-response-guide", tags: ["launch-hold"] },
  }]);
  await page.goto("/shop");
  await expect(page.locator("[data-product-card]")).toHaveCount(1);
  await expect(page.getByTestId("prepared-resource-preview")).toHaveCount(3);
  await expect(page.getByTestId("notice-offer-preview")).toHaveCount(3);
  await expect(page.getByTestId("prepared-resource-previews")).not.toContainText("Notice Response Guide");
  await page.goto("/shop?category=courses&area=housing");
  await expect(page.locator("[data-product-card]")).toHaveCount(1);
  await expect(page.getByTestId("prepared-resource-preview")).toHaveCount(0);
  await expect(page.getByTestId("notice-offer-preview")).toHaveCount(0);
});
