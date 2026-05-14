import { test, expect } from "@playwright/test";

test.describe("ConnectButton", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders in the nav with correct label", async ({ page }) => {
    const btn = page.locator('[data-testid="rk-connect-button"]');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText("Connect Wallet");
  });

  test("button is enabled and interactive", async ({ page }) => {
    const btn = page.locator('[data-testid="rk-connect-button"]');
    await expect(btn).toBeEnabled();
    await expect(btn).toBeVisible();
  });

  test("opens wallet selection modal on click", async ({ page }) => {
    await page.locator('[data-testid="rk-connect-button"]').click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Connect a Wallet");
  });

  test("modal lists all wallet options", async ({ page }) => {
    await page.locator('[data-testid="rk-connect-button"]').click();

    await expect(page.locator('[data-testid="rk-wallet-option-rainbow"]')).toBeVisible();
    await expect(page.locator('[data-testid="rk-wallet-option-base"]')).toBeVisible();
    await expect(page.locator('[data-testid="rk-wallet-option-metaMask"]')).toBeVisible();
    await expect(page.locator('[data-testid="rk-wallet-option-walletConnect"]')).toBeVisible();
  });

  test("modal can be dismissed via close button", async ({ page }) => {
    await page.locator('[data-testid="rk-connect-button"]').click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    await page.locator('[aria-label="Close"]').click();
    await expect(modal).not.toBeVisible();
  });

  test("modal closes when clicking outside", async ({ page }) => {
    await page.locator('[data-testid="rk-connect-button"]').click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Click on the backdrop (outside the modal)
    await page.mouse.click(10, 10);
    await expect(modal).not.toBeVisible();
  });

  test("button is present on /marketplace route", async ({ page }) => {
    await page.goto("/marketplace");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('nav [data-testid="rk-connect-button"]')).toBeVisible();
  });

  test("button is present on /dashboard route", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('nav [data-testid="rk-connect-button"]')).toBeVisible();
  });

  test("button is present on /verify route", async ({ page }) => {
    await page.goto("/verify");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('nav [data-testid="rk-connect-button"]')).toBeVisible();
  });
});
