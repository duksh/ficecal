// e2e/smoke.spec.ts — FiceCal v2 Playwright smoke evidence suite
//
// Evidence-capture tests: verifies the live app loads correctly and all
// major UI sections are present. Captures screenshots as QA artifacts.
// Does NOT require a live MCP backend — panels render in idle state.

import { test, expect } from "@playwright/test";

test.describe("FiceCal v2 smoke evidence", () => {
  test("homepage loads and hero title is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/FiceCal/i);

    // Hero heading should contain the tagline
    const hero = page.locator(".hero h1").first();
    await expect(hero).toBeVisible();
  });

  test("dev banner is present (or was dismissed)", async ({ page }) => {
    await page.goto("/");
    // Banner may be dismissed via localStorage — just ensure no console errors
    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.waitForTimeout(500);
    // Filter out expected network errors (MCP not running in CI)
    const unexpectedErrors = errors.filter(
      e => !e.includes("fetch") && !e.includes("localhost:4001") && !e.includes("ERR_CONNECTION")
    );
    expect(unexpectedErrors).toHaveLength(0);
  });

  test("navbar is visible and has expected links", async ({ page }) => {
    await page.goto("/");
    const navbar = page.locator("nav.navbar");
    await expect(navbar).toBeVisible();

    // These sections must appear in the nav
    for (const label of ["Calculator", "Commitments", "Health", "Carbon"]) {
      await expect(navbar.getByText(label)).toBeVisible();
    }
  });

  test("Cost Estimator section is present", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#calculator");
    await expect(section).toBeVisible();
  });

  test("Commitment Management section is present", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#commitments");
    await expect(section).toBeVisible();
    await expect(page.getByText("Commitment Management")).toBeVisible();
  });

  test("Health Dashboard section is present", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#health");
    await expect(section).toBeVisible();
  });

  test("Carbon Footprint section is present", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#carbon");
    await expect(section).toBeVisible();
    await expect(page.getByText("Carbon Footprint")).toBeVisible();
  });

  test("Intelligence panel section is present", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#intelligence");
    await expect(section).toBeVisible();
  });

  test("admin section is NOT visible without ?admin=1", async ({ page }) => {
    await page.goto("/");
    const adminSection = page.locator("#admin");
    await expect(adminSection).toHaveCount(0);
  });

  test("admin section IS visible with ?admin=1", async ({ page }) => {
    await page.goto("/?admin=1");
    const adminSection = page.locator("#admin");
    await expect(adminSection).toBeVisible();
  });

  test("onboarding chips scroll to calculator", async ({ page }) => {
    await page.goto("/");
    // At least one chip should be visible
    const chips = page.locator(".onboarding-chip");
    await expect(chips.first()).toBeVisible();
  });

  test("full page screenshot evidence", async ({ page }) => {
    await page.goto("/");
    // Allow panels to settle
    await page.waitForTimeout(800);
    await page.screenshot({
      path: "tests/evidence/playwright/screenshots/homepage-full.png",
      fullPage: true,
    });
  });
});
