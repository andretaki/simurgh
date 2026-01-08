import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display company profile settings heading', async ({ page }) => {
    await expect(page.locator('text=Company Profile Settings')).toBeVisible();
  });

  test('should display company information section', async ({ page }) => {
    await expect(page.locator('text=Company Information')).toBeVisible();
  });

  test('should display CAGE Code input', async ({ page }) => {
    await expect(page.locator('#cageCode')).toBeVisible();
  });

  test('should display business classifications section', async ({ page }) => {
    await expect(page.locator('text=Business Classifications')).toBeVisible();
  });

  test('should display default quote settings section', async ({ page }) => {
    await expect(page.locator('text=Default Quote Settings')).toBeVisible();
  });

  test('should display contact information section', async ({ page }) => {
    await expect(page.locator('text=Contact Information')).toBeVisible();
  });

  test('should have save button', async ({ page }) => {
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    // Use first() to get the navigation button link specifically
    await expect(page.locator('a:has-text("Projects")').first()).toBeVisible();
    await expect(page.locator('a:has-text("Workflow")').first()).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Use a more specific selector for the heading
    await expect(page.locator('h2:has-text("Company Profile"), .text-2xl:has-text("Company Profile")')).toBeVisible();
  });
});
