import { test, expect } from '../fixtures/base-test';

/**
 * E2E Tests for Branded Vendor Quote PDF Feature
 *
 * Tests cover:
 * - Validation checklist blocks generation when required fields missing
 * - Vendor quote section with vendorQuoteRef, quoteValidUntil, notes
 * - Branded quote PDF generation
 * - Workflow dashboard display of vendorQuoteRef
 */

test.describe('Branded Vendor Quote PDF', () => {
  const rfqId = '1';

  test.beforeEach(async ({ page, testHelpers }) => {
    // Mock the RFQ data
    await testHelpers.mockApiResponse(`**/api/rfq/${rfqId}`, {
      id: parseInt(rfqId),
      fileName: 'test-rfq.pdf',
      s3Url: 'https://example.com/test-rfq.pdf',
      rfqNumber: 'FA8501-24-Q-0001',
      status: 'processed',
      extractedFields: {
        rfqSummary: {
          header: {
            rfqNumber: 'FA8501-24-Q-0001',
            rfqDate: '2024-12-01',
            responseDeadline: '2024-12-31',
          },
          buyer: {
            contractingOffice: 'AFLCMC/HIB',
            pocName: 'John Doe',
            pocEmail: 'john.doe@us.af.mil',
          },
          items: [
            {
              itemNumber: '0001',
              nsn: '6810-01-234-5678',
              productType: 'Chemical Compound',
              shortDescription: 'Acetone, Technical Grade',
              quantity: 100,
              unit: 'GL',
              unitOfIssue: 'GL',
            },
            {
              itemNumber: '0002',
              nsn: '6810-01-234-5679',
              productType: 'Chemical Compound',
              shortDescription: 'Isopropyl Alcohol, 99%',
              quantity: 50,
              unit: 'GL',
              unitOfIssue: 'GL',
            },
          ],
        },
      },
    });

    // Mock company profile
    await testHelpers.mockApiResponse('**/api/company-profile', {
      id: 1,
      companyName: 'Alliance Chemical',
      cageCode: '12345',
      samUei: 'ABC123DEF456',
      naicsCode: '325199',
      contactPerson: 'Boss Man',
      contactEmail: 'boss@alliancechemical.com',
      contactPhone: '512-365-6838',
      address: '204 S. Edmond St., Taylor, TX 76574',
    });

    // Mock response endpoint
    await testHelpers.mockApiResponse(`**/api/rfq/${rfqId}/response`, {
      id: 1,
      rfqDocumentId: parseInt(rfqId),
      status: 'draft',
    });
  });

  test('should show validation checklist with missing fields', async ({ page }) => {
    await page.goto(`/rfq/${rfqId}/fill`);

    // Wait for the page to load
    await page.waitForSelector('[data-testid="submission-checklist"], text=Submission Checklist', { timeout: 10000 });

    // The checklist should show warnings when prices are not filled
    const checklist = page.locator('text=Submission Checklist').first();
    await expect(checklist).toBeVisible();

    // Should show that unit prices are required
    const missingPriceWarning = page.locator('text=/Unit price required|At least one line item must have pricing/i');
    await expect(missingPriceWarning.first()).toBeVisible();
  });

  test('should block branded quote generation when validation fails', async ({ page }) => {
    await page.goto(`/rfq/${rfqId}/fill`);

    // Wait for page to load
    await page.waitForSelector('button:has-text("Download Branded Quote PDF")', { timeout: 10000 });

    // The branded quote button should be disabled when validation fails
    const brandedButton = page.locator('button:has-text("Download Branded Quote PDF")');
    await expect(brandedButton).toBeDisabled();
  });

  test('should enable generation when prices are filled', async ({ page }) => {
    await page.goto(`/rfq/${rfqId}/fill`);

    // Wait for page to load and find price inputs
    await page.waitForSelector('input[placeholder*="Unit Cost"]', { timeout: 10000 });

    // Fill in prices for line items
    const priceInputs = page.locator('input[placeholder*="Unit Cost"]');
    const inputCount = await priceInputs.count();

    for (let i = 0; i < inputCount; i++) {
      await priceInputs.nth(i).fill('99.99');
    }

    // Wait for validation to update
    await page.waitForTimeout(500);

    // The branded quote button should now be enabled
    const brandedButton = page.locator('button:has-text("Download Branded Quote PDF")');
    await expect(brandedButton).toBeEnabled();

    // Checklist should show success
    const successMessage = page.locator('text=All required fields are complete');
    await expect(successMessage).toBeVisible();
  });

  test('should display vendor quote ref input', async ({ page }) => {
    await page.goto(`/rfq/${rfqId}/fill`);

    // Wait for page to load
    await page.waitForSelector('text=Vendor Quote Reference', { timeout: 10000 });

    // Should have vendor quote ref input
    const vendorQuoteRefInput = page.locator('input[placeholder*="ACQ-RFQ"]');
    await expect(vendorQuoteRefInput).toBeVisible();

    // Should be auto-populated with expected format
    const value = await vendorQuoteRefInput.inputValue();
    expect(value).toMatch(/^ACQ-RFQ-/);
  });

  test('should display quote valid until date picker', async ({ page }) => {
    await page.goto(`/rfq/${rfqId}/fill`);

    // Wait for page to load
    await page.waitForSelector('text=Quote Valid Until', { timeout: 10000 });

    // Should have date input
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput.first()).toBeVisible();

    // Should be auto-populated with a future date
    const value = await dateInput.first().inputValue();
    expect(value).toBeTruthy();

    // The date should be in the future
    const date = new Date(value);
    expect(date.getTime()).toBeGreaterThan(Date.now());
  });

  test('should display notes textarea', async ({ page }) => {
    await page.goto(`/rfq/${rfqId}/fill`);

    // Wait for page to load
    await page.waitForSelector('text=Notes / Exceptions', { timeout: 10000 });

    // Should have notes textarea
    const notesTextarea = page.locator('textarea[placeholder*="Keep brief"]');
    await expect(notesTextarea).toBeVisible();
  });

  test('should generate branded quote PDF when button clicked', async ({ page, testHelpers }) => {
    // Mock the generate-branded endpoint to return a PDF
    await page.route(`**/api/rfq/${rfqId}/generate-branded`, async (route) => {
      // Return a mock PDF response
      const pdfContent = Buffer.from('%PDF-1.4 mock pdf content');
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: {
          'Content-Disposition': 'attachment; filename="AllianceChemicalQuote_ACQ-RFQ-FA8501-24-Q-0001-1.pdf"',
          'X-Vendor-Quote-Ref': 'ACQ-RFQ-FA8501-24-Q-0001-1',
          'X-Quote-Valid-Until': '2025-01-15',
        },
        body: pdfContent,
      });
    });

    await page.goto(`/rfq/${rfqId}/fill`);

    // Fill in required prices
    await page.waitForSelector('input[placeholder*="Unit Cost"]', { timeout: 10000 });
    const priceInputs = page.locator('input[placeholder*="Unit Cost"]');
    const inputCount = await priceInputs.count();

    for (let i = 0; i < inputCount; i++) {
      await priceInputs.nth(i).fill('99.99');
    }

    // Wait for validation
    await page.waitForTimeout(500);

    // Click the branded quote button
    const brandedButton = page.locator('button:has-text("Download Branded Quote PDF")');
    await expect(brandedButton).toBeEnabled();

    // Set up download listener
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      brandedButton.click(),
    ]);

    // Verify the download occurred
    expect(download.suggestedFilename()).toContain('AllianceChemicalQuote');
  });
});

test.describe('Workflow Dashboard - Vendor Quote Ref', () => {
  test.beforeEach(async ({ testHelpers }) => {
    // Mock the workflow API to return records with vendorQuoteRef
    await testHelpers.mockApiResponse('**/api/workflow*', {
      workflows: [
        {
          rfqNumber: 'FA8501-24-Q-0001',
          poNumber: null,
          status: 'response_submitted',
          statusLabel: 'Quote Submitted',
          rfq: {
            id: 1,
            fileName: 'test-rfq.pdf',
            rfqNumber: 'FA8501-24-Q-0001',
            contractingOffice: 'AFLCMC/HIB',
            dueDate: '2024-12-31T00:00:00Z',
            createdAt: '2024-12-01T00:00:00Z',
          },
          response: {
            id: 1,
            status: 'completed',
            submittedAt: '2024-12-10T00:00:00Z',
            vendorQuoteRef: 'ACQ-RFQ-FA8501-24-Q-0001-1',
            generatedPdfUrl: 'https://example.com/buyer-form.pdf',
            generatedBrandedQuoteUrl: 'https://example.com/branded-quote.pdf',
          },
          po: null,
          qualitySheet: null,
          labels: [],
          rfqReceivedAt: '2024-12-01T00:00:00Z',
          responseSubmittedAt: '2024-12-10T00:00:00Z',
          poReceivedAt: null,
          verifiedAt: null,
        },
      ],
      count: 1,
      limit: 50,
      offset: 0,
    });
  });

  test('should display vendorQuoteRef in workflow list', async ({ page }) => {
    await page.goto('/workflow');

    // Wait for workflow data to load
    await page.waitForSelector('text=ACQ-RFQ-FA8501-24-Q-0001-1', { timeout: 10000 });

    // Should display the vendor quote ref
    const quoteRef = page.locator('text=ACQ-RFQ-FA8501-24-Q-0001-1');
    await expect(quoteRef).toBeVisible();
  });

  test('should display PDF download links', async ({ page }) => {
    await page.goto('/workflow');

    // Wait for workflow data to load
    await page.waitForSelector('text=ACQ-RFQ-FA8501-24-Q-0001-1', { timeout: 10000 });

    // Should have buyer form link
    const buyerLink = page.locator('a:has-text("Buyer")');
    await expect(buyerLink.first()).toBeVisible();

    // Should have branded quote link
    const quoteLink = page.locator('a:has-text("Quote")');
    await expect(quoteLink.first()).toBeVisible();
  });

  test('should search by vendorQuoteRef', async ({ page }) => {
    await page.goto('/workflow');

    // Wait for page to load
    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

    // Search for vendor quote ref
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('ACQ-RFQ-FA8501');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should still show the matching workflow
    const quoteRef = page.locator('text=ACQ-RFQ-FA8501-24-Q-0001-1');
    await expect(quoteRef).toBeVisible();
  });
});
