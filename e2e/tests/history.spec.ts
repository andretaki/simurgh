import { test, expect } from '@playwright/test';

test.describe('History Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history');
    // Wait for loading to complete (spinner to disappear)
    await page.waitForLoadState('networkidle');
    // Wait for either the heading or the loading to complete
    await page.waitForSelector('h1:has-text("RFQ History")', { timeout: 10000 }).catch(() => {});
  });

  test('should display RFQ History heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("RFQ History")')).toBeVisible();
  });

  test('should display search input', async ({ page }) => {
    await expect(page.locator('input[type="text"]')).toBeVisible();
  });

  test('should display filter buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Processed")').first()).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    await expect(page.locator('text=Total RFQs')).toBeVisible();
    // Use a more specific selector for the card description
    await expect(page.locator('[class*="CardDescription"]:has-text("Processed"), p:has-text("Processed")')).toBeVisible();
  });

  test('should display Time Saved stat', async ({ page }) => {
    await expect(page.locator('text=Time Saved')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1:has-text("RFQ History")')).toBeVisible();
  });

  test('should display RFQ list or empty state', async ({ page }) => {
    // Either shows RFQs or "No RFQs found" message
    const hasRfqs = await page.locator('.hover\\:shadow-lg').count() > 0;
    const hasEmptyState = await page.locator('text=No RFQs found').isVisible().catch(() => false);

    expect(hasRfqs || hasEmptyState).toBeTruthy();
  });
});
