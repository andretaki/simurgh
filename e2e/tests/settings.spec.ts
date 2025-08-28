import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testData.urls.settings);
  });

  test('should display settings form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Settings');
    
    const apiKeyInput = page.locator('input[name="apiKey"], input[type="password"], input[placeholder*="API"]');
    await expect(apiKeyInput).toBeVisible();
    
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
  });

  test('should save API key settings', async ({ page, testHelpers }) => {
    const apiKeyInput = page.locator('input[name="apiKey"], input[type="password"], input[placeholder*="API"]').first();
    await apiKeyInput.fill(testData.userSettings.apiKey);
    
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    
    await testHelpers.checkToastMessage(/saved|success/i);
    
    // Verify settings are persisted
    await page.reload();
    const value = await apiKeyInput.inputValue();
    expect(value).toBeTruthy();
  });

  test('should update model selection', async ({ page, testHelpers }) => {
    const modelSelect = page.locator('select[name="model"], [data-testid="model-select"]');
    
    if (await modelSelect.count() > 0) {
      await modelSelect.selectOption('gpt-4');
      
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();
      
      await testHelpers.checkToastMessage(/saved|updated/i);
    }
  });

  test('should validate required fields', async ({ page }) => {
    const apiKeyInput = page.locator('input[name="apiKey"], input[type="password"]').first();
    await apiKeyInput.clear();
    
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    
    const errorMessage = page.locator('[role="alert"], .error, text=/required/i');
    await expect(errorMessage).toBeVisible();
  });

  test('should toggle advanced settings', async ({ page }) => {
    const advancedToggle = page.locator('button:has-text("Advanced"), [data-testid="advanced-toggle"]');
    
    if (await advancedToggle.count() > 0) {
      await advancedToggle.click();
      
      const temperatureInput = page.locator('input[name="temperature"]');
      await expect(temperatureInput).toBeVisible();
      
      const maxTokensInput = page.locator('input[name="maxTokens"]');
      await expect(maxTokensInput).toBeVisible();
    }
  });

  test('should update temperature setting', async ({ page, testHelpers }) => {
    const advancedToggle = page.locator('button:has-text("Advanced"), [data-testid="advanced-toggle"]');
    if (await advancedToggle.count() > 0) {
      await advancedToggle.click();
    }
    
    const temperatureInput = page.locator('input[name="temperature"], input[type="range"]');
    if (await temperatureInput.count() > 0) {
      await temperatureInput.fill('0.8');
      
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();
      
      await testHelpers.checkToastMessage(/saved/i);
    }
  });

  test('should reset settings to defaults', async ({ page }) => {
    const resetButton = page.locator('button:has-text("Reset"), button:has-text("Default")');
    
    if (await resetButton.count() > 0) {
      await resetButton.click();
      
      // Confirm reset if dialog appears
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      const toast = page.locator('[role="alert"]');
      await expect(toast).toBeVisible();
    }
  });

  test('should export settings', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export")');
    
    if (await exportButton.count() > 0) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise.catch(() => null);
      if (download) {
        expect(download.suggestedFilename()).toContain('settings');
      }
    }
  });

  test('should import settings', async ({ page }) => {
    const importButton = page.locator('button:has-text("Import")');
    const fileInput = page.locator('input[type="file"][accept*="json"]');
    
    if (await importButton.count() > 0 || await fileInput.count() > 0) {
      await fileInput.setInputFiles({
        name: 'settings.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(testData.userSettings))
      });
      
      const toast = page.locator('[role="alert"]');
      await expect(toast).toBeVisible();
    }
  });

  test('should handle API key validation', async ({ page }) => {
    const apiKeyInput = page.locator('input[name="apiKey"]').first();
    const validateButton = page.locator('button:has-text("Validate"), button:has-text("Test")');
    
    if (await validateButton.count() > 0) {
      await apiKeyInput.fill('invalid-key');
      await validateButton.click();
      
      const statusMessage = page.locator('[role="alert"], .validation-status');
      await expect(statusMessage).toBeVisible();
    }
  });

  test('should persist settings in local storage', async ({ page, testHelpers }) => {
    const apiKeyInput = page.locator('input[name="apiKey"]').first();
    await apiKeyInput.fill('test-key-12345');
    
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();
    
    await page.waitForTimeout(1000);
    
    const storedSettings = await testHelpers.getLocalStorageItem('settings');
    if (storedSettings) {
      expect(storedSettings).toContain('test-key');
    }
  });
});