#!/usr/bin/env npx tsx
/**
 * Fix RFQ numbers in the database
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!);

async function fixRFQNumbers() {
  console.log('🔧 Fixing RFQ numbers...\n');
  
  // Get all RFQ documents
  const docs = await client`
    SELECT id, file_name, rfq_number, extracted_fields
    FROM simurgh.rfq_documents
    WHERE file_name != 'email_ingestion_checkpoint'
    ORDER BY id
  `;
  
  console.log(`Found ${docs.length} documents to process\n`);
  
  let updated = 0;
  
  for (const doc of docs) {
    const fileName = doc.file_name;
    let newRfqNumber = doc.rfq_number;
    let docType = 'Document';
    let extractedFields = doc.extracted_fields || {};
    
    // Extract the actual number from filename patterns
    if (fileName.includes('vendorRFQ-')) {
      // Extract RFQ number: vendorRFQ-36204525.pdf -> 36204525
      const match = fileName.match(/vendorRFQ-(\d+)/);
      if (match) {
        newRfqNumber = match[1];
        docType = 'RFQ';
      }
    } else if (fileName.includes('vendorPO-')) {
      // Extract PO number: vendorPO-45690813.pdf -> 45690813
      const match = fileName.match(/vendorPO-(\d+)/);
      if (match) {
        newRfqNumber = match[1];
        docType = 'PO';
      }
    } else if (fileName.includes('packingList-')) {
      // Extract packing list number: packingList-45690813.pdf -> 45690813
      const match = fileName.match(/packingList-(\d+)/);
      if (match) {
        newRfqNumber = match[1];
        docType = 'PackingList';
      }
    }
    
    // Update extracted fields
    extractedFields = {
      ...extractedFields,
      documentType: docType,
      documentNumber: newRfqNumber
    };
    
    // Update the record
    if (newRfqNumber !== doc.rfq_number || docType !== extractedFields.documentType) {
      await client`
        UPDATE simurgh.rfq_documents
        SET 
          rfq_number = ${newRfqNumber},
          extracted_fields = ${JSON.stringify(extractedFields)}
        WHERE id = ${doc.id}
      `;
      
      console.log(`✅ Updated ${fileName}: ${docType} #${newRfqNumber}`);
      updated++;
    }
  }
  
  // Also delete the checkpoint entry if it exists
  const deleted = await client`
    DELETE FROM simurgh.rfq_documents
    WHERE file_name = 'email_ingestion_checkpoint'
    RETURNING id
  `;
  
  if (deleted.length > 0) {
    console.log('\n🗑️  Removed checkpoint entry');
  }
  
  console.log(`\n📊 Summary: Updated ${updated} documents`);
  
  await client.end();
  process.exit(0);
}

fixRFQNumbers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});