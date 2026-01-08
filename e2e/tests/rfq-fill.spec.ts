import { test, expect } from '@playwright/test';

/**
 * E2E Tests for RFQ Fill Page
 *
 * These tests verify the quote filling functionality including:
 * - Page structure and layout
 * - Line item pricing inputs
 * - Vendor quote fields
 * - Company info display
 * - Validation checklist
 * - PDF generation buttons
 */

// Mock data matching the actual API response structure
const mockRfqData = {
  id: 1,
  fileName: 'test-rfq.pdf',
  s3Url: 'https://example.com/test.pdf',
  extractedFields: {
    rfqSummary: {
      header: {
        rfqNumber: 'SPE4A5-24-Q-0123',
        rfqDate: '2024-01-15',
        requestedReplyDate: '2024-02-15',
        deliveryBeforeDate: '2024-03-15'
      },
      buyer: {
        contractingOffice: 'DLA Troop Support',
        pocName: 'John Smith',
        pocEmail: 'john.smith@dla.mil',
        pocPhone: '215-555-1234'
      },
      items: [
        {
          itemNumber: '0001',
          quantity: 100,
          unit: 'BT',
          nsn: '6810-01-234-5678',
          partNumber: 'AC-1234',
          productType: 'Sodium Hydroxide Solution',
          shortDescription: '50% NaOH solution, 1 gallon bottles'
        },
        {
          itemNumber: '0002',
          quantity: 50,
          unit: 'DR',
          nsn: '6810-01-987-6543',
          partNumber: 'AC-5678',
          productType: 'Hydrochloric Acid',
          shortDescription: '37% HCl solution, 55 gallon drums'
        }
      ]
    }
  }
};

const mockCompanyProfile = {
  companyName: 'Alliance Chemical',
  cageCode: '1ABC2',
  samUei: 'ABCD1234EFGH',
  naicsCode: '424690',
  contactPerson: 'Jane Doe',
  defaultPaymentTerms: 'Net 30',
  defaultFob: 'origin',
  businessType: 'small',
  smallDisadvantaged: true,
  womanOwned: false,
  veteranOwned: false,
  serviceDisabledVetOwned: false,
  hubZone: false
};

test.describe('RFQ Fill Page - Loading States', () => {
  test('should show loading spinner initially', async ({ page }) => {
    // Don't fulfill route immediately to catch loading state
    await page.route('**/api/rfq/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({ status: 200, body: JSON.stringify(mockRfqData) });
    });

    await page.goto('/rfq/1/fill');

    // Should show loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should show not found message for invalid RFQ', async ({ page }) => {
    await page.route('**/api/rfq/**', async (route) => {
      if (route.request().url().includes('/response')) {
        await route.fulfill({ status: 404 });
      } else {
        await route.fulfill({ status: 404 });
      }
    });
    await page.route('**/api/company-profile', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockCompanyProfile) });
    });

    await page.goto('/rfq/999/fill');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=RFQ not found')).toBeVisible();
  });
});

test.describe('RFQ Fill Page - With Data', () => {
  test.beforeEach(async ({ page }) => {
    // Mock all required endpoints
    await page.route('**/api/rfq/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRfqData)
      });
    });

    await page.route('**/api/rfq/1/response', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 404 });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      }
    });

    await page.route('**/api/company-profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCompanyProfile)
      });
    });

    await page.goto('/rfq/1/fill');
    await page.waitForLoadState('networkidle');
    // Wait for loading to complete
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});
  });

  test('should display RFQ number in header', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('SPE4A5-24-Q-0123');
  });

  test('should display contracting office', async ({ page }) => {
    await expect(page.locator('text=DLA Troop Support')).toBeVisible();
  });

  test('should display due date badge', async ({ page }) => {
    await expect(page.locator('text=Due 2024-02-15')).toBeVisible();
  });

  test('should display back link to projects', async ({ page }) => {
    const backLink = page.locator('a:has-text("Back")');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/projects');
  });

  test('should display line items section with count', async ({ page }) => {
    await expect(page.locator('text=Line Items (2)')).toBeVisible();
  });

  test('should display line item quantities', async ({ page }) => {
    // First item: 100 BT
    await expect(page.locator('text=100').first()).toBeVisible();
    // Second item: 50 DR
    await expect(page.locator('text=50').first()).toBeVisible();
  });

  test('should display NSN for line items', async ({ page }) => {
    await expect(page.locator('text=6810-01-234-5678')).toBeVisible();
    await expect(page.locator('text=6810-01-987-6543')).toBeVisible();
  });

  test('should display unit price input for each line item', async ({ page }) => {
    // The big green unit price input
    const priceInputs = page.locator('input[placeholder="Enter price"]');
    await expect(priceInputs).toHaveCount(2);
  });

  test('should display Your Quote section for each item', async ({ page }) => {
    const quoteHeaders = page.locator('text=Your Quote');
    await expect(quoteHeaders.first()).toBeVisible();
  });

  test('should display auto-filled delivery days and origin', async ({ page }) => {
    // Shows "45 days" and "Made in USA" as auto-filled
    await expect(page.locator('text=45 days').first()).toBeVisible();
    await expect(page.locator('text=Made in USA').first()).toBeVisible();
  });

  test('should display No Bid checkbox for line items', async ({ page }) => {
    const noBidCheckboxes = page.locator('input[type="checkbox"]');
    // At least one no-bid checkbox per line item
    expect(await noBidCheckboxes.count()).toBeGreaterThanOrEqual(2);
  });

  test('should display company info section', async ({ page }) => {
    await expect(page.locator('text=Your Company Info')).toBeVisible();
  });

  test('should display CAGE code from profile', async ({ page }) => {
    await expect(page.locator('text=1ABC2')).toBeVisible();
  });

  test('should display SAM UEI from profile', async ({ page }) => {
    await expect(page.locator('text=ABCD1234EFGH')).toBeVisible();
  });

  test('should display NAICS code from profile', async ({ page }) => {
    await expect(page.locator('text=424690')).toBeVisible();
  });

  test('should display SDB badge when smallDisadvantaged is true', async ({ page }) => {
    await expect(page.locator('text=SDB')).toBeVisible();
  });

  test('should display Submission Checklist', async ({ page }) => {
    await expect(page.locator('text=Submission Checklist')).toBeVisible();
  });

  test('should show validation errors when pricing not filled', async ({ page }) => {
    // Should show "Unit price required" errors
    await expect(page.locator('text=Unit price required').first()).toBeVisible();
  });
});

test.describe('RFQ Fill Page - Vendor Quote Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/rfq/1', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockRfqData) });
    });
    await page.route('**/api/rfq/1/response', async (route) => {
      await route.fulfill({ status: 404 });
    });
    await page.route('**/api/company-profile', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockCompanyProfile) });
    });

    await page.goto('/rfq/1/fill');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});
  });

  test('should display Vendor Quote section', async ({ page }) => {
    await expect(page.locator('h2:has-text("Vendor Quote")')).toBeVisible();
  });

  test('should display vendor quote reference input', async ({ page }) => {
    const input = page.locator('input[placeholder*="ACQ-RFQ"]');
    await expect(input).toBeVisible();
  });

  test('should auto-generate vendor quote reference', async ({ page }) => {
    const input = page.locator('input[placeholder*="ACQ-RFQ"]');
    const value = await input.inputValue();
    expect(value).toContain('ACQ-RFQ');
  });

  test('should display quote valid until date input', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeVisible();
  });

  test('should display notes/exceptions textarea', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Keep brief"]');
    await expect(textarea).toBeVisible();
  });
});

test.describe('RFQ Fill Page - Actions Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/rfq/1', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockRfqData) });
    });
    await page.route('**/api/rfq/1/response', async (route) => {
      await route.fulfill({ status: 404 });
    });
    await page.route('**/api/company-profile', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockCompanyProfile) });
    });

    await page.goto('/rfq/1/fill');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});
  });

  test('should display Save Draft button', async ({ page }) => {
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible();
  });

  test('should display Download Buyer Form button', async ({ page }) => {
    await expect(page.locator('button:has-text("Download Buyer Form")')).toBeVisible();
  });

  test('should display Download Branded Quote button', async ({ page }) => {
    await expect(page.locator('button:has-text("Download Branded Quote")')).toBeVisible();
  });

  test('should have disabled branded quote button when validation fails', async ({ page }) => {
    const brandedButton = page.locator('button:has-text("Download Branded Quote")');
    await expect(brandedButton).toBeDisabled();
  });

  test('should display global no-bid dropdown', async ({ page }) => {
    await expect(page.locator('select:has(option:has-text("Bid (Fill pricing below)"))')).toBeVisible();
  });

  test('should display Original PDF link when s3Url exists', async ({ page }) => {
    await expect(page.locator('a:has-text("Original PDF")')).toBeVisible();
  });

  test('should display Upload Completed button', async ({ page }) => {
    await expect(page.locator('button:has-text("Upload Completed")')).toBeVisible();
  });
});

test.describe('RFQ Fill Page - Pricing Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/rfq/1', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockRfqData) });
    });
    await page.route('**/api/rfq/1/response', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        await route.fulfill({ status: 404 });
      }
    });
    await page.route('**/api/company-profile', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockCompanyProfile) });
    });

    await page.goto('/rfq/1/fill');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});
  });

  test('should enable branded quote button after filling prices', async ({ page }) => {
    // Fill in unit prices for both line items
    const priceInputs = page.locator('input[placeholder="Enter price"]');
    await priceInputs.first().fill('25.50');
    await priceInputs.nth(1).fill('150.00');

    // Branded quote button should now be enabled
    const brandedButton = page.locator('button:has-text("Download Branded Quote")');
    await expect(brandedButton).toBeEnabled();
  });

  test('should show line total when price is entered', async ({ page }) => {
    const priceInput = page.locator('input[placeholder="Enter price"]').first();
    await priceInput.fill('25.50');

    // Should show total for 100 units: $2,550.00
    await expect(page.locator('text=$2,550.00')).toBeVisible();
  });

  test('should hide price input when no-bid is checked', async ({ page }) => {
    // Get the first line item's no-bid checkbox
    const noBidCheckbox = page.locator('input[type="checkbox"]').first();
    await noBidCheckbox.check();

    // Price input for that item should be hidden (no longer 2 visible)
    const priceInputs = page.locator('input[placeholder="Enter price"]');
    await expect(priceInputs).toHaveCount(1);
  });

  test('should show no-bid reason dropdown when checked', async ({ page }) => {
    const noBidCheckbox = page.locator('input[type="checkbox"]').first();
    await noBidCheckbox.check();

    // Should show dropdown with reasons - check for the select containing the options
    const noBidSelect = page.locator('select:has(option:has-text("Quantity too low"))');
    await expect(noBidSelect).toBeVisible();
  });
});

test.describe('RFQ Fill Page - Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/rfq/1', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockRfqData) });
    });
    await page.route('**/api/rfq/1/response', async (route) => {
      await route.fulfill({ status: 404 });
    });
    await page.route('**/api/company-profile', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockCompanyProfile) });
    });
  });

  test('should be usable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/rfq/1/fill');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Core elements should still be visible
    await expect(page.locator('main h1')).toContainText('SPE4A5-24-Q-0123');
    await expect(page.locator('input[placeholder="Enter price"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible();
  });
});
