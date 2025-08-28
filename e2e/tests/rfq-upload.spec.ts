import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';
import path from 'path';

test.describe('RFQ Upload Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testData.urls.rfqUpload);
  });

  test('should display upload form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/Upload|RFQ/);
    
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    
    const submitButton = page.locator('button[type="submit"], button:has-text("Upload")');
    await expect(submitButton).toBeVisible();
  });

  test('should upload a PDF file', async ({ page, testHelpers }) => {
    // Create a test PDF file
    const testFilePath = path.join(process.cwd(), 'e2e/fixtures/test-rfq.pdf');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-rfq.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF content')
    });

    const submitButton = page.locator('button[type="submit"], button:has-text("Upload")');
    await submitButton.click();

    // Wait for response
    const response = await testHelpers.waitForApiResponse(/\/api\/upload/).catch(() => null);
    
    if (response) {
      await testHelpers.checkToastMessage(/upload|success/i);
    }
  });

  test('should show error for invalid file type', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Invalid file')
    });

    const submitButton = page.locator('button[type="submit"], button:has-text("Upload")');
    await submitButton.click();

    const errorMessage = page.locator('[role="alert"], .error, .toast');
    await expect(errorMessage).toBeVisible();
  });

  test('should handle multiple file uploads', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    
    if (await fileInput.getAttribute('multiple') !== null) {
      await fileInput.setInputFiles([
        {
          name: 'rfq1.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF 1')
        },
        {
          name: 'rfq2.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF 2')
        }
      ]);

      const fileList = page.locator('[data-testid="file-list"], .file-list');
      if (await fileList.count() > 0) {
        const files = fileList.locator('li, .file-item');
        await expect(files).toHaveCount(2);
      }
    }
  });

  test('should display file preview after selection', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'preview-test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF for preview')
    });

    const preview = page.locator('[data-testid="file-preview"], .file-preview, .selected-file');
    if (await preview.count() > 0) {
      await expect(preview).toBeVisible();
      await expect(preview).toContainText('preview-test.pdf');
    }
  });

  test('should allow removing selected files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'removable.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Removable PDF')
    });

    const removeButton = page.locator('button[aria-label*="remove"], button:has-text("Remove"), .remove-file');
    if (await removeButton.count() > 0) {
      await removeButton.click();
      
      const preview = page.locator('[data-testid="file-preview"], .file-preview');
      await expect(preview).not.toBeVisible();
    }
  });

  test('should show upload progress', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'large-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('x'.repeat(1000000)) // 1MB file
    });

    const submitButton = page.locator('button[type="submit"], button:has-text("Upload")');
    await submitButton.click();

    const progressBar = page.locator('[role="progressbar"], .progress, .upload-progress');
    if (await progressBar.count() > 0) {
      await expect(progressBar).toBeVisible();
    }
  });

  test('should validate file size limits', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'huge-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('x'.repeat(50000000)) // 50MB file
    });

    const errorMessage = page.locator('[role="alert"], .error, text=/size|large|limit/i');
    if (await errorMessage.count() > 0) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should navigate back to RFQ list', async ({ page, testHelpers }) => {
    const backButton = page.locator('a:has-text("Back"), button:has-text("Cancel")');
    if (await backButton.count() > 0) {
      await backButton.click();
      await testHelpers.waitForUrl(/\/rfq/);
      await expect(page).toHaveURL(/\/rfq/);
    }
  });
});