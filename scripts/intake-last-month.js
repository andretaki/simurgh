#!/usr/bin/env node

const https = require('https');

async function intakeLastMonth(baseUrl = 'http://localhost:3000') {
  console.log('🔄 Starting intake of last month\'s emails...\n');
  
  try {
    // First, do a dry run to see what we'll process
    console.log('1️⃣ Checking for emails from last 30 days (dry run)...');
    const dryRunResponse = await fetch(`${baseUrl}/api/email/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daysBack: 30,
        dryRun: true
      })
    });
    
    if (!dryRunResponse.ok) {
      const error = await dryRunResponse.text();
      throw new Error(`Dry run failed: ${error}`);
    }
    
    const dryRunData = await dryRunResponse.json();
    console.log('📊 Found emails to process:');
    console.log(`   Total emails: ${dryRunData.stats.totalEmails}`);
    console.log(`   From noreply@asrcfederal.com: ${dryRunData.stats.fromExpectedSender || 0}`);
    console.log(`   With attachments: ${dryRunData.stats.withAttachments}`);
    console.log(`   To process: ${dryRunData.stats.toProcess}`);
    
    if (dryRunData.emails && dryRunData.emails.length > 0) {
      console.log('\n📧 Email details:');
      dryRunData.emails.forEach((email, idx) => {
        console.log(`   ${idx + 1}. ${email.subject}`);
        console.log(`      From: ${email.from}`);
        console.log(`      Date: ${email.receivedDateTime}`);
        console.log(`      Attachments: ${email.attachmentCount}`);
      });
    }
    
    if (dryRunData.stats.toProcess === 0) {
      console.log('\n✅ No new emails to process.');
      return;
    }
    
    // Ask for confirmation
    console.log('\n2️⃣ Ready to process emails. Press Ctrl+C to cancel, or wait 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Process emails
    console.log('\n3️⃣ Processing emails...');
    const processResponse = await fetch(`${baseUrl}/api/email/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daysBack: 30,
        dryRun: false
      })
    });
    
    if (!processResponse.ok) {
      const error = await processResponse.text();
      throw new Error(`Processing failed: ${error}`);
    }
    
    const processData = await processResponse.json();
    console.log('\n✅ Processing complete!');
    console.log(`   Processed: ${processData.processed || 0} emails`);
    console.log(`   Uploaded: ${processData.uploaded || 0} PDFs to S3`);
    
    if (processData.errors && processData.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      processData.errors.forEach(err => {
        console.log(`   - ${err}`);
      });
    }
    
    // Check health status
    console.log('\n4️⃣ Checking email health status...');
    const healthResponse = await fetch(`${baseUrl}/api/email/health`);
    const health = await healthResponse.json();
    
    console.log(`   Health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`   Last run: ${health.lastRun || 'Never'}`);
    console.log(`   Next lookback: ${health.nextLookback.lookbackDays} days`);
    
    console.log('\n🎉 Intake complete! PDFs should now be available in the system.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Check if running on Vercel or locally
const args = process.argv.slice(2);
const isVercel = args.includes('--vercel');
const baseUrl = isVercel ? 'https://simurgh-delta.vercel.app' : 'http://localhost:3000';

console.log(`Using ${isVercel ? 'Vercel' : 'local'} endpoint: ${baseUrl}`);
intakeLastMonth(baseUrl);