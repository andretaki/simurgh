import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';

test.describe('RFQ Fill Page', () => {
  const rfqId = 'test-rfq-123';
  
  test.beforeEach(async ({ page, testHelpers }) => {
    await testHelpers.mockApiResponse(`**/api/rfq/${rfqId}*`, {
      id: rfqId,
      title: 'Test RFQ',
      fields: [
        { name: 'company_name', label: 'Company Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'budget', label: 'Budget', type: 'number', required: true },
        { name: 'description', label: 'Description', type: 'textarea', required: false }
      ]
    });
    
    await page.goto(`/rfq/${rfqId}/fill`);
  });

  test('should display RFQ form fields', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/Fill|Complete|Submit/i);
    
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    const companyNameInput = form.locator('input[name="company_name"]');
    await expect(companyNameInput).toBeVisible();
    
    const emailInput = form.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    const errorMessages = page.locator('.error, [role="alert"]');
    await expect(errorMessages).toHaveCount(3); // 3 required fields
  });

  test('should validate email format', async ({ page }) => {
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill('invalid-email');
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    const emailError = page.locator('input[name="email"] ~ .error, [data-field="email"] .error');
    await expect(emailError).toBeVisible();
  });

  test('should successfully submit form', async ({ page, testHelpers }) => {
    await testHelpers.fillForm({
      company_name: 'Test Company',
      email: 'test@example.com',
      budget: '50000',
      description: 'Test description for RFQ'
    });
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    await testHelpers.checkToastMessage(/success|submitted/i);
    await testHelpers.waitForUrl('/rfq-done');
  });

  test('should save draft automatically', async ({ page, testHelpers }) => {
    const companyNameInput = page.locator('input[name="company_name"]');
    await companyNameInput.fill('Draft Company');
    
    await page.waitForTimeout(2000); // Wait for auto-save
    
    const draftIndicator = page.locator('text=/Draft saved|Auto-saved/i');
    if (await draftIndicator.count() > 0) {
      await expect(draftIndicator).toBeVisible();
    }
    
    // Verify draft is saved in local storage
    const draft = await testHelpers.getLocalStorageItem(`rfq-draft-${rfqId}`);
    if (draft) {
      expect(draft).toContain('Draft Company');
    }
  });

  test('should restore draft on page reload', async ({ page, testHelpers }) => {
    // Save draft first
    await testHelpers.setLocalStorageItem(`rfq-draft-${rfqId}`, JSON.stringify({
      company_name: 'Restored Company',
      email: 'restored@example.com'
    }));
    
    await page.reload();
    
    const companyNameInput = page.locator('input[name="company_name"]');
    await expect(companyNameInput).toHaveValue('Restored Company');
    
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toHaveValue('restored@example.com');
  });

  test('should handle file attachments', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles({
        name: 'attachment.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content')
      });
      
      const filePreview = page.locator('.file-preview, [data-testid="file-list"]');
      await expect(filePreview).toContainText('attachment.pdf');
    }
  });

  test('should show progress indicator', async ({ page }) => {
    const progressBar = page.locator('[role="progressbar"], .progress-indicator');
    
    if (await progressBar.count() > 0) {
      await expect(progressBar).toBeVisible();
      
      // Fill first field
      await page.locator('input[name="company_name"]').fill('Test');
      await page.waitForTimeout(500);
      
      // Check progress updated
      const progressText = page.locator('.progress-text, [aria-valuenow]');
      if (await progressText.count() > 0) {
        const value = await progressText.getAttribute('aria-valuenow');
        expect(Number(value)).toBeGreaterThan(0);
      }
    }
  });

  test('should handle conditional fields', async ({ page }) => {
    const triggerField = page.locator('select[name="company_type"]');
    
    if (await triggerField.count() > 0) {
      await triggerField.selectOption('enterprise');
      
      // Check if conditional field appears
      const conditionalField = page.locator('input[name="enterprise_id"]');
      await expect(conditionalField).toBeVisible();
      
      await triggerField.selectOption('startup');
      await expect(conditionalField).not.toBeVisible();
    }
  });

  test('should validate budget range', async ({ page }) => {
    const budgetInput = page.locator('input[name="budget"]');
    await budgetInput.fill('999999999'); // Very large number
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    const budgetError = page.locator('input[name="budget"] ~ .error');
    if (await budgetError.count() > 0) {
      await expect(budgetError).toContainText(/range|maximum/i);
    }
  });

  test('should provide field help tooltips', async ({ page }) => {
    const helpIcons = page.locator('[data-testid="help-icon"], .help-icon, [aria-label*="help"]');
    
    if (await helpIcons.count() > 0) {
      const firstHelp = helpIcons.first();
      await firstHelp.hover();
      
      const tooltip = page.locator('[role="tooltip"], .tooltip');
      await expect(tooltip).toBeVisible();
    }
  });

  test('should handle session timeout', async ({ page }) => {
    // Simulate session timeout
    await page.route('**/api/rfq/*/submit', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Session expired' })
      });
    });
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toContainText(/session|expired|login/i);
  });
});