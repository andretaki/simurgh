import { test, expect } from '@playwright/test';

test.describe('Projects Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    // Wait for main content h1 to load
    await page.waitForSelector('main h1', { timeout: 10000 });
  });

  test('should display projects page heading', async ({ page }) => {
    // Target the h1 in the main content area specifically
    await expect(page.locator('main h1')).toContainText('Projects');
  });

  test('should have New Project button', async ({ page }) => {
    // Use first() since there may be multiple New Project buttons (header + empty state)
    const newProjectButton = page.locator('button:has-text("New Project")').first();
    await expect(newProjectButton).toBeVisible();
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test('should display workflow legend', async ({ page }) => {
    await expect(page.locator('h3:has-text("Workflow")')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('main h1')).toBeVisible();
  });

  test('should display projects list or empty state', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Either shows projects or "No projects yet" message
    const hasProjects = await page.locator('a[href^="/projects/"]').count() > 0;
    const hasEmptyState = await page.locator('text=No projects yet').isVisible().catch(() => false);

    expect(hasProjects || hasEmptyState).toBeTruthy();
  });
});
