// playwright.config.ts — FiceCal v2 smoke-evidence suite
//
// Starts vite preview against the already-built dist/ directory.
// Tests run headlessly in CI (chromium) and capture screenshots as evidence.
//
// Run locally:
//   pnpm build && pnpm test:playwright

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "tests/evidence/reports/junit/results.xml" }],
  ],
  use: {
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:4173",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },
  // Start vite preview (serves the already-built dist/) before running tests
  webServer: {
    command: "pnpm preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
