# Legacy Document (Migrated)

This document was migrated from the repo root (`E2E_TESTING.md`) into `docs/legacy/`.

- For the documentation index, see `docs/README.md`.

---

# E2E Testing Documentation

## Overview
This project uses Playwright for comprehensive end-to-end testing. The test suite covers all major user flows and ensures the application works correctly across different browsers and devices.

## Setup

### Installation
```bash
npm install
npx playwright install
```

### Environment Variables
Create a `.env.test` file with the following variables:
```env
DATABASE_URL=your_test_database_url
OPENAI_API_KEY=your_test_api_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=your_aws_region
S3_BUCKET_NAME=your_test_bucket
```

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Debug tests
npm run test:debug

# Run tests in headed mode
npm run test:headed

# Run specific browser tests
npm run test:chrome
npm run test:firefox
npm run test:webkit

# Run mobile tests
npm run test:mobile

# View test report
npm run test:report

# Generate test code
npm run test:codegen
```

### Running Specific Tests
```bash
# Run a specific test file
npx playwright test e2e/tests/home.spec.ts

# Run tests matching a pattern
npx playwright test -g "should display"

# Run tests in a specific project
npx playwright test --project=chromium
```

## Test Structure

### Directory Layout
```
e2e/
├── fixtures/
│   ├── base-test.ts       # Custom test fixtures
│   ├── test-data.ts       # Test data and mocks
│   ├── global-setup.ts    # Global setup
│   └── global-teardown.ts # Global teardown
├── helpers/
│   ├── test-helpers.ts    # Reusable test utilities
│   ├── error-handler.ts   # Error handling utilities
│   └── performance-monitor.ts # Performance monitoring
├── tests/
│   ├── home.spec.ts       # Home page tests
│   ├── rfq.spec.ts        # RFQ listing tests
│   ├── rfq-upload.spec.ts # RFQ upload tests
│   ├── rfq-fill.spec.ts   # RFQ form fill tests
│   ├── settings.spec.ts   # Settings page tests
│   ├── history.spec.ts    # History page tests
│   ├── analytics.spec.ts  # Analytics page tests
│   └── rfq-pro.spec.ts    # RFQ Pro features tests
├── screenshots/           # Test screenshots
├── videos/               # Test videos
└── reports/              # Test reports
```

## Writing Tests

### Basic Test Structure
```typescript
import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page, testHelpers }) => {
    // Arrange
    const element = page.locator('selector');
    
    // Act
    await element.click();
    
    // Assert
    await expect(element).toBeVisible();
  });
});
```

### Using Test Helpers
```typescript
test('should fill and submit form', async ({ page, testHelpers }) => {
  // Fill form using helper
  await testHelpers.fillForm({
    name: 'John Doe',
    email: 'john@example.com'
  });
  
  // Check toast message
  await testHelpers.checkToastMessage('Success');
  
  // Wait for navigation
  await testHelpers.waitForUrl('/success');
});
```

### Mocking API Responses
```typescript
test('should handle API responses', async ({ page, testHelpers }) => {
  await testHelpers.mockApiResponse('**/api/data', {
    status: 'success',
    data: mockData
  });
  
  await page.goto('/page');
  // Test with mocked data
});
```

## Best Practices

### 1. Page Object Model
Create page objects for complex pages:
```typescript
class RFQPage {
  constructor(private page: Page) {}
  
  async searchRFQ(query: string) {
    await this.page.fill('[data-testid="search"]', query);
    await this.page.press('[data-testid="search"]', 'Enter');
  }
  
  async uploadFile(filePath: string) {
    await this.page.setInputFiles('input[type="file"]', filePath);
  }
}
```

### 2. Data-TestId Attributes
Use data-testid attributes for reliable element selection:
```tsx
<button data-testid="submit-button">Submit</button>
```

### 3. Wait Strategies
Always wait for appropriate conditions:
```typescript
// Wait for element
await page.waitForSelector('[data-testid="loading"]', { state: 'hidden' });

// Wait for navigation
await page.waitForURL(/\/success/);

// Wait for network idle
await page.waitForLoadState('networkidle');
```

### 4. Error Handling
Use the error handler for comprehensive error tracking:
```typescript
test.afterEach(async ({ page }, testInfo) => {
  const errorHandler = new ErrorHandler(page, testInfo);
  await errorHandler.handleTestFailure();
});
```

### 5. Performance Monitoring
Monitor performance in critical tests:
```typescript
test('should load quickly', async ({ page }) => {
  const monitor = new PerformanceMonitor(page);
  await monitor.startMonitoring();
  
  await page.goto('/');
  
  const metrics = await monitor.collectMetrics();
  expect(metrics.navigation.loadComplete).toBeLessThan(3000);
});
```

## CI/CD Integration

### GitHub Actions
The project includes a comprehensive GitHub Actions workflow that:
- Runs tests on multiple browsers
- Performs visual regression testing
- Runs Lighthouse performance audits
- Generates and publishes test reports
- Archives test artifacts

### Running in CI
```yaml
- name: Run E2E Tests
  run: npx playwright test
  env:
    CI: true
```

## Debugging

### Debug Mode
```bash
# Run with debug mode
npm run test:debug

# Set breakpoint in code
await page.pause();
```

### Trace Viewer
```bash
# Run with trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

### Screenshots and Videos
Tests automatically capture screenshots and videos on failure. Find them in:
- Screenshots: `e2e/screenshots/`
- Videos: `e2e/videos/`
- Error screenshots: `e2e/screenshots/errors/`

## Performance Testing

### Core Web Vitals
Tests monitor Core Web Vitals:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

### Bundle Size Monitoring
Tests check bundle sizes to prevent regression:
```typescript
const bundleSize = await monitor.checkBundleSize();
expect(bundleSize.js).toBeLessThan(500000); // 500KB
```

## Accessibility Testing

### Basic Checks
Tests include basic accessibility checks:
```typescript
await testHelpers.checkAccessibility();
```

### Manual Testing
For comprehensive accessibility testing, use:
```bash
# Generate accessibility report
npx playwright test --grep @a11y
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout in playwright.config.ts
   - Check if application is running
   - Verify network conditions

2. **Element not found**
   - Use more specific selectors
   - Add data-testid attributes
   - Wait for element to be visible

3. **Flaky tests**
   - Add proper wait conditions
   - Use retry mechanism
   - Check for race conditions

4. **CI failures**
   - Check environment variables
   - Verify browser installation
   - Review CI logs

## Maintenance

### Regular Tasks
- Update Playwright: `npm update @playwright/test`
- Update browsers: `npx playwright install`
- Review and update test data
- Archive old test results
- Monitor test execution time

### Test Coverage Goals
- Critical paths: 100%
- Happy paths: 90%
- Error scenarios: 80%
- Edge cases: 70%

## Contributing

### Adding New Tests
1. Create test file in appropriate directory
2. Use existing helpers and fixtures
3. Follow naming conventions
4. Add to CI workflow if needed
5. Document any special setup

### Test Review Checklist
- [ ] Tests are deterministic
- [ ] No hardcoded waits
- [ ] Proper error handling
- [ ] Uses test helpers
- [ ] Includes assertions
- [ ] Handles both success and failure cases
- [ ] No test interdependencies
- [ ] Cleanup after test

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-test)
- [Debugging Guide](https://playwright.dev/docs/debug)
