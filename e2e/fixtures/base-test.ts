import { test as base } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';

type TestFixtures = {
  testHelpers: TestHelpers;
};

export const test = base.extend<TestFixtures>({
  testHelpers: async ({ page }, use) => {
    const helpers = new TestHelpers(page);
    await use(helpers);
  },
});

export { expect } from '@playwright/test';