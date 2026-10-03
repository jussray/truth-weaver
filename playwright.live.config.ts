import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.LIVE_BASE_URL;
if (!baseURL) throw new Error("LIVE_BASE_URL is required for deployed runtime proof.");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/live-notice-analyzer",
  timeout: 120_000,
  expect: { timeout: 90_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "live-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
