#!/usr/bin/env npx tsx
/**
 * Quick import of RFQ documents from S3 without AI processing
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import postgres from 'postgres';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const client = postgres(process.env.DATABASE_URL!);

async function quickImport() {
  console.log('🚀 Quick S3 import starting...\n');
  
  // List all documents in S3
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_S3_BUCKET!,
    Prefix: 'rfqs/',
  });
  
  const response = await s3Client.send(command);
  const s3Objects = response.Contents || [];
  
  // Filter for PDF documents only
  const pdfDocuments = s3Objects.filter(obj => 
    obj.Key?.endsWith('.pdf') && 
    !obj.Key.includes('checkpoint')
  );
  
  console.log(`Found ${pdfDocuments.length} PDF documents\n`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const s3Object of pdfDocuments) {
    const key = s3Object.Key!;
    const fileName = key.split('/').pop()!;
    
    try {
      // Check if already exists
      const existing = await client`
        SELECT id FROM simurgh.rfq_documents 
        WHERE s3_key = ${key}
        LIMIT 1
      `;
      
      if (existing.length > 0) {
        console.log(`⏭️  Skipping ${fileName} (already exists)`);
        skipped++;
        continue;
      }
      
      // Extract basic info from filename
      let docType = 'RFQ';
      let docNumber = null;
      
      if (fileName.includes('vendorRFQ')) {
        docType = 'RFQ';
        docNumber = fileName.match(/\d+/)?.[0] || null;
      } else if (fileName.includes('vendorPO')) {
        docType = 'PO';
        docNumber = fileName.match(/\d+/)?.[0] || null;
      } else if (fileName.includes('packingList')) {
        docType = 'PackingList';
        docNumber = fileName.match(/\d+/)?.[0] || null;
      }
      
      // Simple insert without AI processing
      const result = await client`
        INSERT INTO simurgh.rfq_documents (
          file_name,
          s3_key,
          s3_url,
          file_size,
          mime_type,
          status,
          rfq_number,
          extracted_fields,
          created_at,
          updated_at
        ) VALUES (
          ${fileName},
          ${key},
          ${`https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`},
          ${s3Object.Size || 0},
          'application/pdf',
          'pending',
          ${docNumber},
          ${JSON.stringify({ documentType: docType, documentNumber: docNumber })},
          ${s3Object.LastModified?.toISOString() || new Date().toISOString()},
          ${new Date().toISOString()}
        )
        RETURNING id
      `;
      
      console.log(`✅ Imported ${fileName} (ID: ${result[0].id})`);
      imported++;
      
    } catch (error: any) {
      console.error(`❌ Failed ${fileName}:`, error.message);
    }
  }
  
  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📁 Total: ${pdfDocuments.length}`);
  
  await client.end();
  process.exit(0);
}

quickImport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});