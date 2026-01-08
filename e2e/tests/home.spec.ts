import { test, expect } from '@playwright/test';

test.describe('Home Page (Dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait for the main content to load
    await page.waitForSelector('main h1', { timeout: 10000 });
  });

  test('should display the dashboard heading', async ({ page }) => {
    // Target the h1 in the main content area specifically
    await expect(page.locator('main h1')).toContainText('Dashboard');
  });

  test('should display stats cards', async ({ page }) => {
    // Check for stat cards - these are always present
    await expect(page.locator('text=Awaiting Quote')).toBeVisible();
    await expect(page.locator('text=Awaiting PO')).toBeVisible();
    await expect(page.locator('text=In Verification')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });

  test('should have New Project button', async ({ page }) => {
    // The New Project button is inside a Link component in main content
    const newProjectButton = page.locator('main button:has-text("New Project"), main a:has-text("New Project")');
    await expect(newProjectButton.first()).toBeVisible();
  });

  test('should display Recent Projects section', async ({ page }) => {
    await expect(page.locator('text=Recent Projects')).toBeVisible();
  });

  test('should display workflow section', async ({ page }) => {
    await expect(page.locator('h3:has-text("Workflow")')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('main h1')).toBeVisible();
  });

  test('should navigate to projects when clicking New Project', async ({ page }) => {
    await page.click('main button:has-text("New Project"), main a:has-text("New Project")');
    await expect(page).toHaveURL(/\/projects/);
  });
});
