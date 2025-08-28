import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('Running global teardown...');

  // Clean up test files if not in CI
  if (!process.env.CI) {
    try {
      const testFilesDir = path.join(process.cwd(), 'e2e/fixtures/test-files');
      const files = await fs.readdir(testFilesDir);
      
      for (const file of files) {
        if (file.startsWith('temp-') || file.startsWith('test-')) {
          await fs.unlink(path.join(testFilesDir, file));
        }
      }
      console.log('Cleaned up test files');
    } catch (error) {
      console.error('Error cleaning up test files:', error);
    }
  }

  // Generate summary report
  await generateSummaryReport();

  // Clean up auth state if exists
  try {
    await fs.unlink('e2e/fixtures/auth.json');
    console.log('Cleaned up auth state');
  } catch (error) {
    // Auth file might not exist
  }

  // Archive old test results
  if (process.env.ARCHIVE_RESULTS) {
    await archiveTestResults();
  }

  console.log('Global teardown completed');
}

async function generateSummaryReport() {
  try {
    const reportPath = path.join(process.cwd(), 'test-results.json');
    const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
    
    if (reportExists) {
      const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
      
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: report.suites?.reduce((acc: number, suite: any) => acc + suite.specs.length, 0) || 0,
        passed: report.suites?.reduce((acc: number, suite: any) => 
          acc + suite.specs.filter((spec: any) => spec.ok).length, 0) || 0,
        failed: report.suites?.reduce((acc: number, suite: any) => 
          acc + suite.specs.filter((spec: any) => !spec.ok).length, 0) || 0,
        duration: report.duration || 0,
        config: report.config || {}
      };

      await fs.writeFile(
        path.join(process.cwd(), 'e2e/reports/summary.json'),
        JSON.stringify(summary, null, 2)
      );

      console.log('Test Summary:');
      console.log(`  Total: ${summary.totalTests}`);
      console.log(`  Passed: ${summary.passed}`);
      console.log(`  Failed: ${summary.failed}`);
      console.log(`  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    }
  } catch (error) {
    console.error('Failed to generate summary report:', error);
  }
}

async function archiveTestResults() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(process.cwd(), 'e2e/archives', timestamp);
    
    await fs.mkdir(archiveDir, { recursive: true });
    
    // Archive playwright report
    const reportDir = path.join(process.cwd(), 'playwright-report');
    const reportExists = await fs.access(reportDir).then(() => true).catch(() => false);
    
    if (reportExists) {
      await fs.cp(reportDir, path.join(archiveDir, 'playwright-report'), { recursive: true });
    }
    
    // Archive test results
    const resultsDir = path.join(process.cwd(), 'test-results');
    const resultsExist = await fs.access(resultsDir).then(() => true).catch(() => false);
    
    if (resultsExist) {
      await fs.cp(resultsDir, path.join(archiveDir, 'test-results'), { recursive: true });
    }
    
    // Archive screenshots
    const screenshotsDir = path.join(process.cwd(), 'e2e/screenshots');
    const screenshotsExist = await fs.access(screenshotsDir).then(() => true).catch(() => false);
    
    if (screenshotsExist) {
      await fs.cp(screenshotsDir, path.join(archiveDir, 'screenshots'), { recursive: true });
    }
    
    console.log(`Test results archived to: ${archiveDir}`);
    
    // Clean up old archives (keep last 10)
    const archivesDir = path.join(process.cwd(), 'e2e/archives');
    const archives = await fs.readdir(archivesDir);
    
    if (archives.length > 10) {
      const toDelete = archives.sort().slice(0, archives.length - 10);
      for (const dir of toDelete) {
        await fs.rm(path.join(archivesDir, dir), { recursive: true });
      }
      console.log(`Cleaned up ${toDelete.length} old archives`);
    }
  } catch (error) {
    console.error('Failed to archive test results:', error);
  }
}

export default globalTeardown;