import { test, expect } from '@playwright/test';

test('Capture ARES Terminal Screenshots', async ({ page }) => {
  // Increase viewport for professional look
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Home Page / Landing
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000); // Allow animations to finish
  await page.screenshot({ path: 'ARES_UI_Home.png', fullPage: false });

  // 2. Marketplace
  await page.goto('http://localhost:3000/marketplace');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'ARES_UI_Marketplace.png' });

  // 3. Dashboard
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'ARES_UI_Dashboard.png' });

  // 4. Verify Page
  await page.goto('http://localhost:3000/verify');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'ARES_UI_Verify.png' });
});
