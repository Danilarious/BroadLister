import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/playwright",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BROADLISTER_E2E_BASE_URL ?? "http://127.0.0.1:4100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "pnpm --filter @broadlister/api dev",
      url: "http://127.0.0.1:3021/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: "pnpm --filter @broadlister/web dev",
      url: "http://127.0.0.1:4100",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 950 } }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ]
});
