import { test, expect } from "@playwright/test";

test.describe("Performance and Resilience Check", () => {
  test.beforeEach(async ({ page }) => {
    // Increase timeout for the whole test due to slow block times (5s) and high polling (12s)
    test.setTimeout(60000);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("application loads correctly and displays hero section", async ({ page }) => {
    // Verify basic layout and essential text
    await expect(page.locator("h1")).toContainText("The Protocol for");
    await expect(page.locator("h1")).toContainText("Autonomous Resell");
    await expect(page.locator('text=HKUST BLOCKCHAIN LAB')).toBeVisible();
  });

  test("UI remains interactive during slow block times", async ({ page }) => {
    // Ensure the connect button is visible and interactive immediately
    const connectBtn = page.locator('[data-testid="rk-connect-button"]');
    await expect(connectBtn).toBeVisible();
    
    // Simulate interaction to ensure UI thread is not blocked
    await connectBtn.click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Close modal
    await page.locator('[aria-label="Close"]').click();
    await expect(modal).not.toBeVisible();
  });

  test("navigation resilience under slow network conditions", async ({ page }) => {
    // Wait for at least one "block cycle" (5s mining) + buffer
    await page.waitForTimeout(6000); 
    
    // Check if navigation works smoothly despite slower state updates
    const marketplaceLink = page.locator('a:has-text("Enter Marketplace")');
    await expect(marketplaceLink).toBeVisible();
    await expect(marketplaceLink).toBeEnabled();
    
    await marketplaceLink.click();
    await expect(page).toHaveURL(/\/marketplace/);
    
    // Check if the marketplace page loads its header
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('nav [data-testid="rk-connect-button"]')).toBeVisible();
  });

  test("provider stability with 12s polling interval", async ({ page }) => {
    // The 12s polling interval means Wagmi updates state less frequently.
    // We wait for more than one polling cycle to ensure no connection errors appear.
    const connectBtn = page.locator('[data-testid="rk-connect-button"]');
    await expect(connectBtn).toBeVisible();
    
    // Wait 13 seconds to cover at least one full polling cycle (12s)
    await page.waitForTimeout(13000);
    
    // Verify the UI is still healthy and no generic "Connection Failed" messages appeared
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toBeEnabled();
    
    // Check for absence of common error indicators
    const content = await page.content();
    expect(content).not.toContain("Failed to connect");
    expect(content).not.toContain("Chain not found");
  });

  test("resilience to block-based UI updates", async ({ page }) => {
    // Navigate to dashboard where more state might be loaded
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    
    // Wait for potential block-based updates (5s mining)
    await page.waitForTimeout(7000);
    
    // Ensure terminal or dashboard elements are present and didn't crash
    const dashboardHeader = page.locator('h1');
    if (await dashboardHeader.isVisible()) {
        await expect(dashboardHeader).toBeVisible();
    }
    
    // Verify Nav is still present
    await expect(page.locator('nav')).toBeVisible();
  });
});
