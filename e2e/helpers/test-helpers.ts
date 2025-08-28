import { Page, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  async waitForLoadComplete() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async uploadFile(selector: string, filePath: string) {
    const fileInput = this.page.locator(selector);
    await fileInput.setInputFiles(filePath);
  }

  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      const input = this.page.locator(`[name="${field}"], [id="${field}"], [data-testid="${field}"]`);
      await input.fill(value);
    }
  }

  async clickAndWaitForNavigation(selector: string) {
    await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(selector)
    ]);
  }

  async checkToastMessage(message: string) {
    const toast = this.page.locator('[role="alert"]');
    await expect(toast).toContainText(message);
  }

  async waitForApiResponse(url: string | RegExp) {
    return this.page.waitForResponse(url);
  }

  async mockApiResponse(url: string | RegExp, response: any) {
    await this.page.route(url, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  async checkAccessibility() {
    const violations = await this.page.evaluate(() => {
      // Basic accessibility checks
      const images = Array.from(document.querySelectorAll('img'));
      const missingAlt = images.filter(img => !img.alt);
      
      const buttons = Array.from(document.querySelectorAll('button'));
      const missingAriaLabel = buttons.filter(btn => 
        !btn.textContent?.trim() && !btn.getAttribute('aria-label')
      );

      return {
        missingAlt: missingAlt.length,
        missingAriaLabel: missingAriaLabel.length
      };
    });

    expect(violations.missingAlt).toBe(0);
    expect(violations.missingAriaLabel).toBe(0);
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `e2e/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  async waitForElement(selector: string, options?: { timeout?: number }) {
    await this.page.waitForSelector(selector, options);
  }

  async getElementText(selector: string): Promise<string> {
    const element = this.page.locator(selector);
    return await element.textContent() || '';
  }

  async isElementVisible(selector: string): Promise<boolean> {
    const element = this.page.locator(selector);
    return await element.isVisible();
  }

  async selectOption(selector: string, value: string) {
    const select = this.page.locator(selector);
    await select.selectOption(value);
  }

  async clearAndType(selector: string, text: string) {
    const input = this.page.locator(selector);
    await input.clear();
    await input.type(text);
  }

  async waitForUrl(urlPattern: string | RegExp) {
    await this.page.waitForURL(urlPattern);
  }

  async checkPageTitle(expectedTitle: string) {
    await expect(this.page).toHaveTitle(expectedTitle);
  }

  async checkUrl(expectedUrl: string | RegExp) {
    await expect(this.page).toHaveURL(expectedUrl);
  }

  async scrollToElement(selector: string) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate((k) => localStorage.getItem(k), key);
  }

  async setLocalStorageItem(key: string, value: string) {
    await this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
  }

  async clearLocalStorage() {
    await this.page.evaluate(() => localStorage.clear());
  }

  async checkElementCount(selector: string, expectedCount: number) {
    const elements = this.page.locator(selector);
    await expect(elements).toHaveCount(expectedCount);
  }

  async waitForTextToAppear(text: string, options?: { timeout?: number }) {
    await this.page.waitForSelector(`text="${text}"`, options);
  }

  async checkElementAttribute(selector: string, attribute: string, value: string) {
    const element = this.page.locator(selector);
    await expect(element).toHaveAttribute(attribute, value);
  }
}