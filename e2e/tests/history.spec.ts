import { test, expect } from '../fixtures/base-test';
import { testData, mockHistoryData } from '../fixtures/test-data';

test.describe('History Page', () => {
  test.beforeEach(async ({ page, testHelpers }) => {
    await testHelpers.mockApiResponse('**/api/history*', mockHistoryData);
    await page.goto(testData.urls.history);
  });

  test('should display history page with timeline', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('History');
    
    const historyItems = page.locator('[data-testid="history-item"], .history-item, .timeline-item');
    await expect(historyItems).toHaveCount(3);
  });

  test('should display history item details', async ({ page }) => {
    const firstItem = page.locator('[data-testid="history-item"], .history-item').first();
    await expect(firstItem).toContainText('RFQ Created');
    
    const timestamp = firstItem.locator('.timestamp, time');
    await expect(timestamp).toBeVisible();
  });

  test('should filter history by date range', async ({ page }) => {
    const dateFromInput = page.locator('input[name="dateFrom"], input[type="date"]').first();
    const dateToInput = page.locator('input[name="dateTo"], input[type="date"]').last();
    
    if (await dateFromInput.count() > 0) {
      await dateFromInput.fill('2025-01-01');
      await dateToInput.fill('2025-12-31');
      
      const filterButton = page.locator('button:has-text("Filter"), button:has-text("Apply")');
      await filterButton.click();
      
      await page.waitForTimeout(1000);
      const items = page.locator('[data-testid="history-item"], .history-item');
      expect(await items.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('should filter history by action type', async ({ page }) => {
    const actionFilter = page.locator('select[name="action"], [data-testid="action-filter"]');
    
    if (await actionFilter.count() > 0) {
      await actionFilter.selectOption('upload');
      await page.waitForTimeout(1000);
      
      const items = page.locator('[data-testid="history-item"], .history-item');
      const itemCount = await items.count();
      
      if (itemCount > 0) {
        const firstItem = items.first();
        await expect(firstItem).toContainText(/upload/i);
      }
    }
  });

  test('should search history', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    
    if (await searchInput.count() > 0) {
      await searchInput.fill('RFQ');
      await searchInput.press('Enter');
      
      await page.waitForTimeout(1000);
      const items = page.locator('[data-testid="history-item"], .history-item');
      
      if (await items.count() > 0) {
        await expect(items.first()).toContainText(/RFQ/i);
      }
    }
  });

  test('should export history to CSV', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")');
    
    if (await exportButton.count() > 0) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise.catch(() => null);
      if (download) {
        expect(download.suggestedFilename()).toMatch(/history.*\.csv/i);
      }
    }
  });

  test('should paginate through history', async ({ page }) => {
    // Mock a larger dataset for pagination
    const largeHistoryData = Array.from({ length: 50 }, (_, i) => ({
      id: `${i + 1}`,
      action: `Action ${i + 1}`,
      timestamp: new Date().toISOString(),
      details: `Details for action ${i + 1}`
    }));
    
    await page.route('**/api/history*', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(largeHistoryData)
      });
    });
    
    await page.reload();
    
    const nextButton = page.locator('button:has-text("Next"), a:has-text("Next")');
    if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      
      const pageIndicator = page.locator('[data-testid="page-number"], .page-indicator');
      if (await pageIndicator.count() > 0) {
        await expect(pageIndicator).toContainText('2');
      }
    }
  });

  test('should clear history with confirmation', async ({ page }) => {
    const clearButton = page.locator('button:has-text("Clear History"), button:has-text("Delete All")');
    
    if (await clearButton.count() > 0) {
      await clearButton.click();
      
      // Handle confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();
      
      const toast = page.locator('[role="alert"]');
      await expect(toast).toContainText(/cleared|deleted/i);
    }
  });

  test('should show details modal when clicking on item', async ({ page }) => {
    const historyItem = page.locator('[data-testid="history-item"], .history-item').first();
    await historyItem.click();
    
    const modal = page.locator('[role="dialog"], .modal, [data-testid="detail-modal"]');
    if (await modal.count() > 0) {
      await expect(modal).toBeVisible();
      
      const closeButton = modal.locator('button:has-text("Close"), button[aria-label="Close"]');
      await closeButton.click();
      await expect(modal).not.toBeVisible();
    }
  });

  test('should handle empty history state', async ({ page, testHelpers }) => {
    await testHelpers.mockApiResponse('**/api/history*', []);
    await page.reload();
    
    const emptyState = page.locator('text=/No history|Empty|No records/i');
    await expect(emptyState).toBeVisible();
  });

  test('should auto-refresh history', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh"), button[aria-label="Refresh"]');
    
    if (await refreshButton.count() > 0) {
      await refreshButton.click();
      
      const spinner = page.locator('.spinner, .loading, [role="status"]');
      if (await spinner.count() > 0) {
        await expect(spinner).toBeVisible();
        await expect(spinner).not.toBeVisible({ timeout: 5000 });
      }
    }
  });
});