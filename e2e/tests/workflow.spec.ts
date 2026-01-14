import { test, expect } from '@playwright/test';

test.describe('Workflow Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workflow');
    // Use domcontentloaded instead of networkidle to avoid timeout on polling pages
    await page.waitForLoadState('domcontentloaded');
    // Wait for main content to appear
    await page.waitForSelector('main h1', { timeout: 10000 });
  });

  test('should display workflow page heading', async ({ page }) => {
    // Page shows "Workflow Pipeline" as the h1
    await expect(page.locator('main h1')).toContainText('Workflow Pipeline');
  });

  test('should display search input', async ({ page }) => {
    // Search input has specific placeholder
    await expect(page.locator('input[placeholder*="Search by RFQ"]')).toBeVisible();
  });

  test('should display workflow status cards', async ({ page }) => {
    // Should have status cards: RFQ, Draft, Submitted, No Bid, etc.
    await expect(page.locator('text=RFQ').first()).toBeVisible();
    await expect(page.locator('text=Draft').first()).toBeVisible();
    await expect(page.locator('text=Submitted').first()).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('main h1')).toBeVisible();
  });

  test('should display workflow records or empty state', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Shows "All Workflows (N)" section
    await expect(page.locator('text=All Workflows')).toBeVisible();
  });
});
