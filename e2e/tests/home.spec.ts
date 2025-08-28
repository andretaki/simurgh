import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testData.urls.home);
  });

  test('should display the main heading and welcome message', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Simurgh');
    await expect(page.locator('p').first()).toContainText('wise phoenix');
  });

  test('should have navigation links', async ({ page }) => {
    const navLinks = [
      { text: 'RFQ', href: '/rfq' },
      { text: 'Settings', href: '/settings' },
      { text: 'History', href: '/history' },
      { text: 'Analytics', href: '/analytics' }
    ];

    for (const link of navLinks) {
      const navLink = page.locator(`a:has-text("${link.text}")`);
      await expect(navLink).toBeVisible();
    }
  });

  test('should navigate to RFQ page when clicking Get Started', async ({ page, testHelpers }) => {
    const getStartedButton = page.locator('a:has-text("Get Started")');
    await expect(getStartedButton).toBeVisible();
    
    await getStartedButton.click();
    await testHelpers.waitForUrl(/\/rfq/);
    await expect(page).toHaveURL(/\/rfq/);
  });

  test('should have proper meta tags and title', async ({ page }) => {
    await expect(page).toHaveTitle(/Simurgh/);
    
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('a:has-text("Get Started")')).toBeVisible();
  });

  test('should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForTimeout(2000);
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('should have accessibility features', async ({ testHelpers }) => {
    await testHelpers.checkAccessibility();
  });

  test('should display footer with links', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    
    const footerLinks = [
      'Privacy Policy',
      'Terms of Service',
      'Contact'
    ];

    for (const linkText of footerLinks) {
      const link = footer.locator(`a:has-text("${linkText}")`);
      await expect(link).toBeVisible();
    }
  });
});