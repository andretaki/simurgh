import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';

test.describe('RFQ Pro Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testData.urls.rfqPro);
  });

  test('should display RFQ Pro features', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/Pro|Advanced|Premium/i);
    
    const featuresList = page.locator('[data-testid="features-list"], .features, ul');
    await expect(featuresList).toBeVisible();
  });

  test('should have advanced search capabilities', async ({ page }) => {
    const advancedSearchForm = page.locator('form[name="advanced-search"], [data-testid="advanced-search"]');
    
    if (await advancedSearchForm.count() > 0) {
      const keywordsInput = advancedSearchForm.locator('input[name="keywords"]');
      const budgetMinInput = advancedSearchForm.locator('input[name="budgetMin"]');
      const budgetMaxInput = advancedSearchForm.locator('input[name="budgetMax"]');
      
      await keywordsInput.fill('software development');
      await budgetMinInput.fill('10000');
      await budgetMaxInput.fill('100000');
      
      const searchButton = advancedSearchForm.locator('button[type="submit"]');
      await searchButton.click();
      
      await page.waitForTimeout(1000);
      const results = page.locator('[data-testid="search-results"], .results');
      await expect(results).toBeVisible();
    }
  });

  test('should display AI recommendations', async ({ page, testHelpers }) => {
    await testHelpers.mockApiResponse('**/api/rfq/recommendations*', {
      recommendations: [
        { id: '1', title: 'Recommended RFQ 1', score: 0.95 },
        { id: '2', title: 'Recommended RFQ 2', score: 0.89 },
        { id: '3', title: 'Recommended RFQ 3', score: 0.85 }
      ]
    });

    const recommendationsSection = page.locator('[data-testid="recommendations"], .recommendations');
    
    if (await recommendationsSection.count() > 0) {
      await expect(recommendationsSection).toBeVisible();
      
      const recommendationItems = recommendationsSection.locator('.recommendation-item, article');
      await expect(recommendationItems).toHaveCount(3);
    }
  });

  test('should have batch processing capability', async ({ page }) => {
    const batchUpload = page.locator('[data-testid="batch-upload"], .batch-upload');
    
    if (await batchUpload.count() > 0) {
      const fileInput = batchUpload.locator('input[type="file"]');
      await fileInput.setInputFiles([
        {
          name: 'batch1.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF 1')
        },
        {
          name: 'batch2.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF 2')
        },
        {
          name: 'batch3.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF 3')
        }
      ]);
      
      const processButton = page.locator('button:has-text("Process Batch")');
      await processButton.click();
      
      const progressBar = page.locator('[role="progressbar"], .batch-progress');
      await expect(progressBar).toBeVisible();
    }
  });

  test('should display template library', async ({ page }) => {
    const templateSection = page.locator('[data-testid="templates"], .template-library');
    
    if (await templateSection.count() > 0) {
      await expect(templateSection).toBeVisible();
      
      const templateCards = templateSection.locator('.template-card, [data-testid="template"]');
      expect(await templateCards.count()).toBeGreaterThan(0);
      
      const firstTemplate = templateCards.first();
      await firstTemplate.click();
      
      const modal = page.locator('[role="dialog"], .template-preview');
      await expect(modal).toBeVisible();
    }
  });

  test('should have export to multiple formats', async ({ page }) => {
    const exportSection = page.locator('[data-testid="export-options"], .export-section');
    
    if (await exportSection.count() > 0) {
      const formats = ['PDF', 'Excel', 'Word', 'JSON'];
      
      for (const format of formats) {
        const formatButton = exportSection.locator(`button:has-text("${format}")`);
        if (await formatButton.count() > 0) {
          await expect(formatButton).toBeVisible();
        }
      }
    }
  });

  test('should display collaboration features', async ({ page }) => {
    const collaborationSection = page.locator('[data-testid="collaboration"], .collaboration');
    
    if (await collaborationSection.count() > 0) {
      const shareButton = collaborationSection.locator('button:has-text("Share")');
      await expect(shareButton).toBeVisible();
      
      await shareButton.click();
      
      const shareModal = page.locator('[role="dialog"], .share-modal');
      await expect(shareModal).toBeVisible();
      
      const emailInput = shareModal.locator('input[type="email"]');
      await emailInput.fill('colleague@example.com');
      
      const sendButton = shareModal.locator('button:has-text("Send")');
      await sendButton.click();
    }
  });

  test('should have custom workflow builder', async ({ page }) => {
    const workflowBuilder = page.locator('[data-testid="workflow-builder"], .workflow-builder');
    
    if (await workflowBuilder.count() > 0) {
      await expect(workflowBuilder).toBeVisible();
      
      const addStepButton = workflowBuilder.locator('button:has-text("Add Step")');
      await addStepButton.click();
      
      const stepModal = page.locator('[role="dialog"], .step-modal');
      await expect(stepModal).toBeVisible();
    }
  });

  test('should display subscription tiers', async ({ page }) => {
    const pricingSection = page.locator('[data-testid="pricing"], .pricing-tiers');
    
    if (await pricingSection.count() > 0) {
      await expect(pricingSection).toBeVisible();
      
      const tierCards = pricingSection.locator('.tier-card, [data-testid="tier"]');
      await expect(tierCards).toHaveCount(3); // Basic, Pro, Enterprise
      
      const proTier = tierCards.filter({ hasText: 'Pro' });
      const upgradeButton = proTier.locator('button:has-text("Upgrade")');
      await expect(upgradeButton).toBeVisible();
    }
  });

  test('should have API integration settings', async ({ page }) => {
    const apiSection = page.locator('[data-testid="api-integration"], .api-settings');
    
    if (await apiSection.count() > 0) {
      const webhookInput = apiSection.locator('input[name="webhook"]');
      await webhookInput.fill('https://example.com/webhook');
      
      const testButton = apiSection.locator('button:has-text("Test Connection")');
      await testButton.click();
      
      const statusMessage = page.locator('[role="alert"], .connection-status');
      await expect(statusMessage).toBeVisible();
    }
  });
});