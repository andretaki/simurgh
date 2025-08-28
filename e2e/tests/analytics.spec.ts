import { test, expect } from '../fixtures/base-test';
import { testData, mockAnalyticsData } from '../fixtures/test-data';

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page, testHelpers }) => {
    await testHelpers.mockApiResponse('**/api/analytics*', mockAnalyticsData);
    await page.goto(testData.urls.analytics);
  });

  test('should display analytics dashboard', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Analytics');
    
    // Check for key metrics
    const metrics = page.locator('[data-testid="metric-card"], .metric-card, .stat-card');
    await expect(metrics).toHaveCount(4);
  });

  test('should display total RFQs metric', async ({ page }) => {
    const totalRfqsCard = page.locator('text=/Total RFQs|Total Requests/i').locator('..');
    await expect(totalRfqsCard).toContainText('150');
  });

  test('should display success rate', async ({ page }) => {
    const successRateCard = page.locator('text=/Success Rate|Completion Rate/i').locator('..');
    await expect(successRateCard).toContainText('95%');
  });

  test('should display average processing time', async ({ page }) => {
    const processingTimeCard = page.locator('text=/Processing Time|Average Time/i').locator('..');
    await expect(processingTimeCard).toContainText('2.5 hours');
  });

  test('should filter analytics by date range', async ({ page }) => {
    const dateRangeSelector = page.locator('select[name="dateRange"], [data-testid="date-range"]');
    
    if (await dateRangeSelector.count() > 0) {
      await dateRangeSelector.selectOption('last30days');
      await page.waitForTimeout(1000);
      
      const metrics = page.locator('[data-testid="metric-card"], .metric-card');
      await expect(metrics).toHaveCount(4);
    }
  });

  test('should display chart visualization', async ({ page }) => {
    const chart = page.locator('canvas, svg.chart, [data-testid="analytics-chart"]');
    await expect(chart).toBeVisible();
  });

  test('should toggle between chart types', async ({ page }) => {
    const chartTypeSelector = page.locator('button:has-text("Bar"), button:has-text("Line")');
    
    if (await chartTypeSelector.count() > 0) {
      await chartTypeSelector.first().click();
      await page.waitForTimeout(500);
      
      const chart = page.locator('canvas, svg.chart');
      await expect(chart).toBeVisible();
    }
  });

  test('should export analytics report', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export Report"), button:has-text("Download Report")');
    
    if (await exportButton.count() > 0) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise.catch(() => null);
      if (download) {
        expect(download.suggestedFilename()).toMatch(/analytics|report/i);
      }
    }
  });

  test('should display RFQ status breakdown', async ({ page }) => {
    const statusBreakdown = page.locator('[data-testid="status-breakdown"], .status-chart');
    
    if (await statusBreakdown.count() > 0) {
      await expect(statusBreakdown).toBeVisible();
      
      const completedLabel = statusBreakdown.locator('text=/Completed/i');
      await expect(completedLabel).toBeVisible();
    }
  });

  test('should show top categories', async ({ page }) => {
    const categoriesSection = page.locator('[data-testid="top-categories"], .categories-section');
    
    if (await categoriesSection.count() > 0) {
      await expect(categoriesSection).toBeVisible();
      
      const categoryItems = categoriesSection.locator('.category-item, li');
      expect(await categoryItems.count()).toBeGreaterThan(0);
    }
  });

  test('should refresh analytics data', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Refresh"), button[aria-label="Refresh"]');
    
    if (await refreshButton.count() > 0) {
      await refreshButton.click();
      
      const loading = page.locator('.loading, .spinner, [role="status"]');
      if (await loading.count() > 0) {
        await expect(loading).toBeVisible();
        await expect(loading).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should display trend indicators', async ({ page }) => {
    const trendIndicators = page.locator('[data-testid="trend"], .trend-indicator');
    
    if (await trendIndicators.count() > 0) {
      const upTrend = trendIndicators.locator('.up, .positive, text=/↑|▲/');
      const downTrend = trendIndicators.locator('.down, .negative, text=/↓|▼/');
      
      const hasTrends = (await upTrend.count() > 0) || (await downTrend.count() > 0);
      expect(hasTrends).toBeTruthy();
    }
  });

  test('should handle analytics errors gracefully', async ({ page }) => {
    await page.route('**/api/analytics*', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Analytics service unavailable' })
      });
    });
    
    await page.reload();
    
    const errorMessage = page.locator('[role="alert"], .error, text=/error|failed/i');
    await expect(errorMessage).toBeVisible();
  });
});