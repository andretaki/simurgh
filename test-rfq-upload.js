const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function testRFQUpload() {
  try {
    // Step 1: Get presigned URL
    console.log('1. Getting presigned upload URL...');
    const uploadResponse = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'vendorPO-45659232.pdf',
        contentType: 'application/pdf'
      })
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to get upload URL: ${uploadResponse.statusText}`);
    }

    const { uploadUrl, key } = await uploadResponse.json();
    console.log('✓ Got upload URL, key:', key);

    // Step 2: Upload file to S3
    console.log('2. Uploading file to S3...');
    const fileBuffer = fs.readFileSync('/home/andre/simurgh/public/vendorPO-45659232 (1).pdf');
    
    const s3Response = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/pdf'
      }
    });

    if (!s3Response.ok) {
      throw new Error(`Failed to upload to S3: ${s3Response.statusText}`);
    }
    console.log('✓ File uploaded to S3');

    // Step 3: Process the RFQ
    console.log('3. Processing RFQ...');
    const processResponse = await fetch('http://localhost:3000/api/rfq/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        s3Key: key,
        fileName: 'vendorPO-45659232.pdf'
      })
    });

    if (!processResponse.ok) {
      const error = await processResponse.text();
      throw new Error(`Failed to process RFQ: ${error}`);
    }

    const result = await processResponse.json();
    console.log('✓ RFQ processed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));

    // Step 4: Test the fill page
    console.log('\n4. Testing RFQ fill page...');
    const rfqListResponse = await fetch('http://localhost:3000/api/rfq-summary');
    
    if (!rfqListResponse.ok) {
      throw new Error(`Failed to get RFQ list: ${rfqListResponse.statusText}`);
    }

    const rfqList = await rfqListResponse.json();
    console.log(`✓ Found ${rfqList.length} RFQs available for filling`);
    
    if (rfqList.length > 0) {
      console.log('Latest RFQ:', {
        id: rfqList[0].id,
        filename: rfqList[0].filename,
        created: rfqList[0].createdAt
      });
    }

    console.log('\n✅ All tests passed successfully!');
    console.log('You can now visit http://localhost:3000/rfq-fill to test the UI');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRFQUpload();