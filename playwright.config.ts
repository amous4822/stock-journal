import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright config.
 * - Runs against the dev server (or a custom BASE_URL for CI).
 * - Only Chromium in CI to keep the matrix simple.
 * - global-setup creates an authenticated session stored in e2e/.auth/user.json
 *   so the trade-flow test can skip the Google OAuth dance.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Authenticated state — used by trade-flow spec
    { name: "setup", testMatch: /global-setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
