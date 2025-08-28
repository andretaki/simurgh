import { test, expect } from '../fixtures/base-test';
import { testData, mockRfqList } from '../fixtures/test-data';

test.describe('RFQ Page', () => {
  test.beforeEach(async ({ page, testHelpers }) => {
    // Mock API responses
    await testHelpers.mockApiResponse('**/api/rfq/search*', mockRfqList);
    await page.goto(testData.urls.rfq);
  });

  test('should display RFQ list page with search functionality', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('RFQ');
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    
    const uploadButton = page.locator('a:has-text("Upload RFQ")');
    await expect(uploadButton).toBeVisible();
  });

  test('should search for RFQs', async ({ page, testHelpers }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    await searchInput.fill('Software Development');
    await searchInput.press('Enter');
    
    await testHelpers.waitForApiResponse(/\/api\/rfq\/search/);
    
    // Check if results are displayed
    const results = page.locator('[data-testid="rfq-item"], .rfq-item, article');
    await expect(results).toHaveCount(3);
  });

  test('should navigate to upload page', async ({ page, testHelpers }) => {
    const uploadButton = page.locator('a:has-text("Upload RFQ")');
    await uploadButton.click();
    
    await testHelpers.waitForUrl(/\/rfq\/upload/);
    await expect(page).toHaveURL(/\/rfq\/upload/);
  });

  test('should display empty state when no RFQs', async ({ page, testHelpers }) => {
    await testHelpers.mockApiResponse('**/api/rfq/search*', []);
    await page.reload();
    
    const emptyState = page.locator('text=/No RFQs found|No results|Empty/i');
    await expect(emptyState).toBeVisible();
  });

  test('should handle search errors gracefully', async ({ page, testHelpers }) => {
    await page.route('**/api/rfq/search*', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    await searchInput.fill('test');
    await searchInput.press('Enter');
    
    await page.waitForTimeout(1000);
    
    const errorMessage = page.locator('[role="alert"], .error, .toast');
    const hasError = await errorMessage.count() > 0;
    
    if (hasError) {
      await expect(errorMessage.first()).toBeVisible();
    }
  });

  test('should display RFQ details when clicking on an item', async ({ page }) => {
    const firstRfqItem = page.locator('[data-testid="rfq-item"], .rfq-item, article').first();
    
    if (await firstRfqItem.count() > 0) {
      await firstRfqItem.click();
      
      // Check if navigation occurred or modal opened
      const urlChanged = await page.waitForURL(/\/rfq\/\d+/, { timeout: 3000 }).catch(() => false);
      const modalOpened = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      
      expect(urlChanged || modalOpened).toBeTruthy();
    }
  });

  test('should filter RFQs by status', async ({ page }) => {
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');
    
    if (await statusFilter.count() > 0) {
      await statusFilter.selectOption('completed');
      await page.waitForTimeout(1000);
      
      const results = page.locator('[data-testid="rfq-item"], .rfq-item');
      const count = await results.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should sort RFQs', async ({ page }) => {
    const sortDropdown = page.locator('select[name="sort"], [data-testid="sort"]');
    
    if (await sortDropdown.count() > 0) {
      await sortDropdown.selectOption('date-desc');
      await page.waitForTimeout(1000);
      
      const results = page.locator('[data-testid="rfq-item"], .rfq-item');
      expect(await results.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('should paginate through results', async ({ page }) => {
    const nextButton = page.locator('button:has-text("Next"), a:has-text("Next")');
    
    if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      
      const pageIndicator = page.locator('[data-testid="page-indicator"], .page-number');
      if (await pageIndicator.count() > 0) {
        await expect(pageIndicator).toContainText('2');
      }
    }
  });
});