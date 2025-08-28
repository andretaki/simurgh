import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('Running global setup...');

  // Create necessary directories
  const directories = [
    'e2e/screenshots',
    'e2e/screenshots/errors',
    'e2e/videos',
    'e2e/traces',
    'e2e/reports',
    'e2e/fixtures/test-files'
  ];

  for (const dir of directories) {
    await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
  }

  // Create test files
  await createTestFiles();

  // Set up test database if needed
  if (process.env.CI) {
    console.log('Setting up test database...');
    // Run database migrations for CI
    const { execSync } = require('child_process');
    try {
      execSync('npm run db:push', { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to set up database:', error);
    }
  }

  // Warm up the application
  if (!process.env.SKIP_WARMUP) {
    console.log('Warming up application...');
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto(config.projects[0].use?.baseURL || 'http://localhost:3000', {
        waitUntil: 'networkidle',
        timeout: 60000
      });
      console.log('Application warmed up successfully');
    } catch (error) {
      console.error('Failed to warm up application:', error);
    } finally {
      await browser.close();
    }
  }

  // Store auth state if needed
  if (process.env.TEST_AUTH_REQUIRED) {
    await setupAuthState(config);
  }

  console.log('Global setup completed');
}

async function createTestFiles() {
  // Create sample PDF for testing
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 4 0 R\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n4 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n5 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test RFQ Document) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000274 00000 n\n0000000353 00000 n\ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n447\n%%EOF');
  
  await fs.writeFile(
    path.join(process.cwd(), 'e2e/fixtures/test-files/sample.pdf'),
    pdfContent
  );

  // Create sample JSON for testing
  const jsonContent = JSON.stringify({
    title: 'Test RFQ',
    description: 'This is a test RFQ for E2E testing',
    budget: 50000,
    deadline: '2025-12-31'
  }, null, 2);

  await fs.writeFile(
    path.join(process.cwd(), 'e2e/fixtures/test-files/sample.json'),
    jsonContent
  );

  // Create sample CSV for testing
  const csvContent = `Title,Description,Budget,Deadline
"Test RFQ 1","Description 1",50000,"2025-12-31"
"Test RFQ 2","Description 2",75000,"2025-11-30"
"Test RFQ 3","Description 3",100000,"2025-10-31"`;

  await fs.writeFile(
    path.join(process.cwd(), 'e2e/fixtures/test-files/sample.csv'),
    csvContent
  );
}

async function setupAuthState(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(`${config.projects[0].use?.baseURL}/login`);
    
    // Perform login
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL(/dashboard|home/, { timeout: 10000 });
    
    // Save storage state
    await context.storageState({ path: 'e2e/fixtures/auth.json' });
    console.log('Auth state saved');
  } catch (error) {
    console.error('Failed to setup auth state:', error);
  } finally {
    await browser.close();
  }
}

export default globalSetup;