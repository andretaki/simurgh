import { Page, TestInfo } from '@playwright/test';

export class ErrorHandler {
  private errors: Array<{ message: string; stack?: string; timestamp: Date }> = [];
  private consoleErrors: string[] = [];
  private networkErrors: Array<{ url: string; status: number; method: string }> = [];

  constructor(private page: Page, private testInfo: TestInfo) {
    this.setupErrorListeners();
  }

  private setupErrorListeners() {
    // Capture console errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
        console.error(`Console error: ${msg.text()}`);
      }
    });

    // Capture page errors (uncaught exceptions)
    this.page.on('pageerror', error => {
      this.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      });
      console.error(`Page error: ${error.message}`);
    });

    // Capture failed network requests
    this.page.on('requestfailed', request => {
      this.networkErrors.push({
        url: request.url(),
        status: 0,
        method: request.method()
      });
      console.error(`Request failed: ${request.method()} ${request.url()}`);
    });

    // Capture responses with error status codes
    this.page.on('response', response => {
      if (response.status() >= 400) {
        this.networkErrors.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
        console.error(`HTTP ${response.status()}: ${response.request().method()} ${response.url()}`);
      }
    });
  }

  async captureScreenshotOnError(name?: string) {
    if (this.hasErrors()) {
      const screenshotName = name || `error-${Date.now()}`;
      await this.page.screenshot({
        path: `e2e/screenshots/errors/${screenshotName}.png`,
        fullPage: true
      });
      
      // Attach to test report
      await this.testInfo.attach(`error-screenshot-${screenshotName}`, {
        body: await this.page.screenshot({ fullPage: true }),
        contentType: 'image/png'
      });
    }
  }

  async captureVideoOnError() {
    const video = this.page.video();
    if (video && this.hasErrors()) {
      const path = await video.path();
      await this.testInfo.attach('error-video', {
        path: path,
        contentType: 'video/webm'
      });
    }
  }

  async captureHtmlOnError() {
    if (this.hasErrors()) {
      const html = await this.page.content();
      await this.testInfo.attach('error-page-html', {
        body: html,
        contentType: 'text/html'
      });
    }
  }

  async captureNetworkTrace() {
    const har = await this.page.context().newCDPSession(this.page);
    await har.send('Network.enable');
    
    const entries = await har.send('Network.getAllCookies');
    await this.testInfo.attach('network-cookies', {
      body: JSON.stringify(entries, null, 2),
      contentType: 'application/json'
    });
  }

  hasErrors(): boolean {
    return this.errors.length > 0 || 
           this.consoleErrors.length > 0 || 
           this.networkErrors.length > 0;
  }

  getErrors() {
    return {
      pageErrors: this.errors,
      consoleErrors: this.consoleErrors,
      networkErrors: this.networkErrors
    };
  }

  async generateErrorReport(): Promise<string> {
    const report = {
      testName: this.testInfo.title,
      testFile: this.testInfo.file,
      timestamp: new Date().toISOString(),
      duration: this.testInfo.duration,
      status: this.testInfo.status,
      errors: this.getErrors(),
      browser: this.testInfo.project.name,
      viewport: this.page.viewportSize()
    };

    return JSON.stringify(report, null, 2);
  }

  async retry<T>(
    fn: () => Promise<T>,
    options: {
      retries?: number;
      delay?: number;
      onError?: (error: Error, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const { retries = 3, delay = 1000, onError } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (onError) {
          onError(error as Error, attempt);
        }
        
        if (attempt === retries) {
          throw error;
        }
        
        console.log(`Retry attempt ${attempt}/${retries} after ${delay}ms`);
        await this.page.waitForTimeout(delay);
      }
    }
    
    throw new Error('Retry failed');
  }

  async waitForStability(options: {
    timeout?: number;
    checkInterval?: number;
  } = {}) {
    const { timeout = 10000, checkInterval = 500 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const initialErrorCount = this.errors.length + this.consoleErrors.length;
      await this.page.waitForTimeout(checkInterval);
      const currentErrorCount = this.errors.length + this.consoleErrors.length;
      
      if (currentErrorCount === initialErrorCount) {
        return; // No new errors, page is stable
      }
    }
    
    throw new Error('Page did not stabilize within timeout');
  }

  clearErrors() {
    this.errors = [];
    this.consoleErrors = [];
    this.networkErrors = [];
  }

  async handleTestFailure() {
    if (this.testInfo.status === 'failed') {
      await this.captureScreenshotOnError();
      await this.captureVideoOnError();
      await this.captureHtmlOnError();
      
      const errorReport = await this.generateErrorReport();
      await this.testInfo.attach('error-report', {
        body: errorReport,
        contentType: 'application/json'
      });
    }
  }
}