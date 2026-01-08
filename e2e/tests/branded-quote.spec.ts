import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Branded Vendor Quote PDF Feature
 *
 * Tests the vendor quote section of the RFQ fill page including:
 * - Vendor quote reference auto-generation
 * - Quote valid until date
 * - Notes/exceptions field
 * - Branded quote PDF button state
 */

const mockRfqData = {
  id: 1,
  fileName: 'test-rfq.pdf',
  s3Url: 'https://example.com/test.pdf',
  extractedFields: {
    rfqSummary: {
      header: {
        rfqNumber: 'SPE4A5-24-Q-0456',
        requestedReplyDate: '2024-02-28'
      },
      buyer: {
        contractingOffice: 'DLA Aviation'
      },
      items: [
        {
          itemNumber: '0001',
          quantity: 200,
          unit: 'GL',
          nsn: '6810-00-111-2222',
          productType: 'Acetone',
          shortDescription: 'Industrial grade acetone'
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
  smallDisadvantaged: false,
  womanOwned: true,
  veteranOwned: false,
  serviceDisabledVetOwned: false,
  hubZone: false
};

test.describe('Branded Quote - Vendor Quote Reference', () => {
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

  test('should auto-generate quote reference with RFQ number', async ({ page }) => {
    const input = page.locator('input[placeholder*="ACQ-RFQ"]');
    const value = await input.inputValue();

    // Should contain ACQ-RFQ and the RFQ number
    expect(value).toContain('ACQ-RFQ');
    expect(value).toContain('SPE4A5-24-Q-0456');
  });

  test('should allow editing vendor quote reference', async ({ page }) => {
    const input = page.locator('input[placeholder*="ACQ-RFQ"]');
    await input.clear();
    await input.fill('CUSTOM-REF-001');

    await expect(input).toHaveValue('CUSTOM-REF-001');
  });

  test('should show helper text about quote reference', async ({ page }) => {
    await expect(page.locator('text=Auto-generated')).toBeVisible();
    await expect(page.locator('text=branded quote and PO')).toBeVisible();
  });
});

test.describe('Branded Quote - Quote Valid Until', () => {
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

  test('should display Quote Valid Until label', async ({ page }) => {
    await expect(page.locator('text=Quote Valid Until')).toBeVisible();
  });

  test('should auto-set date to 30 days from now', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]').first();
    const value = await dateInput.inputValue();

    // Should be a valid date string
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Should be approximately 30 days from now
    const selectedDate = new Date(value);
    const today = new Date();
    const diffDays = Math.round((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(32);
  });

  test('should allow changing quote valid date', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill('2025-06-15');

    await expect(dateInput).toHaveValue('2025-06-15');
  });
});

test.describe('Branded Quote - Notes/Exceptions', () => {
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

  test('should display Notes/Exceptions label', async ({ page }) => {
    await expect(page.locator('text=Notes / Exceptions')).toBeVisible();
  });

  test('should display placeholder text', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Keep brief"]');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', 'Keep brief. Do not contradict RFQ terms.');
  });

  test('should allow entering notes', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Keep brief"]');
    await textarea.fill('Delivery subject to carrier availability.');

    await expect(textarea).toHaveValue('Delivery subject to carrier availability.');
  });
});

test.describe('Branded Quote - Button State', () => {
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

  test('should disable branded quote button when pricing incomplete', async ({ page }) => {
    const button = page.locator('button:has-text("Download Branded Quote")');
    await expect(button).toBeDisabled();
  });

  test('should enable branded quote button when pricing complete', async ({ page }) => {
    // Fill in the unit price
    const priceInput = page.locator('input[placeholder="Enter price"]').first();
    await priceInput.fill('45.99');

    const button = page.locator('button:has-text("Download Branded Quote")');
    await expect(button).toBeEnabled();
  });

  test('should show green styling when ready to generate', async ({ page }) => {
    // Fill in the unit price
    const priceInput = page.locator('input[placeholder="Enter price"]').first();
    await priceInput.fill('45.99');

    // Checklist should turn green
    await expect(page.locator('text=All required fields are complete')).toBeVisible();
  });
});

test.describe('Branded Quote - WOSB Badge', () => {
  test('should display WOSB badge when womanOwned is true', async ({ page }) => {
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

    // WOSB = Woman-Owned Small Business badge
    await expect(page.locator('text=WOSB')).toBeVisible();
  });
});

test.describe('Branded Quote - Responsive', () => {
  test('should work on mobile', async ({ page }) => {
    await page.route('**/api/rfq/1', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockRfqData) });
    });
    await page.route('**/api/rfq/1/response', async (route) => {
      await route.fulfill({ status: 404 });
    });
    await page.route('**/api/company-profile', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify(mockCompanyProfile) });
    });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/rfq/1/fill');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Vendor Quote section should be visible
    await expect(page.locator('h2:has-text("Vendor Quote")')).toBeVisible();

    // Quote reference input should be accessible
    const input = page.locator('input[placeholder*="ACQ-RFQ"]');
    await expect(input).toBeVisible();
  });
});
