#!/usr/bin/env npx tsx
/**
 * Import existing RFQ documents from S3 into the database
 * This script reads real RFQ/PO documents from S3 and populates the database
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, sql } from 'drizzle-orm';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';

// Initialize clients
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function listS3Documents() {
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_S3_BUCKET!,
    Prefix: 'rfqs/',
  });
  
  const response = await s3Client.send(command);
  return response.Contents || [];
}

async function downloadFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
  });
  
  const response = await s3Client.send(command);
  const chunks: Uint8Array[] = [];
  
  // @ts-ignore - Body is a readable stream
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

async function extractRFQDetails(pdfText: string, fileName: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract RFQ/PO details from the document. Return JSON with:
          - documentType: "RFQ" | "PO" | "PackingList" | "Quote" | "Invoice"
          - documentNumber: The RFQ/PO/Quote number
          - vendorName: Company name
          - totalAmount: Total amount if available
          - dueDate: Due date if mentioned
          - items: Array of items with description and quantity
          - status: "pending" | "processed"
          
          If you cannot extract a field, use null.`
        },
        {
          role: "user",
          content: `Filename: ${fileName}\n\nDocument text:\n${pdfText.substring(0, 3000)}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    
    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Error extracting RFQ details:', error);
    return {
      documentType: fileName.includes('RFQ') ? 'RFQ' : 'PO',
      documentNumber: fileName.match(/\d+/)?.[0] || null,
      status: 'pending'
    };
  }
}

async function importDocuments() {
  console.log('🚀 Starting S3 to DB import...\n');
  
  // List all documents in S3
  const s3Objects = await listS3Documents();
  console.log(`Found ${s3Objects.length} objects in S3\n`);
  
  // Filter for PDF documents only
  const pdfDocuments = s3Objects.filter(obj => 
    obj.Key?.endsWith('.pdf') && 
    !obj.Key.includes('checkpoint')
  );
  
  console.log(`Found ${pdfDocuments.length} PDF documents to process\n`);
  
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const s3Object of pdfDocuments) {
    const key = s3Object.Key!;
    const fileName = key.split('/').pop()!;
    
    try {
      // Check if already exists in simurgh.rfq_documents
      const existing = await client`
        SELECT id FROM simurgh.rfq_documents 
        WHERE s3_key = ${key}
        LIMIT 1
      `;
      
      if (existing.length > 0) {
        console.log(`⏭️  Skipping ${fileName} (already in DB)`);
        skipped++;
        continue;
      }
      
      console.log(`📥 Processing ${fileName}...`);
      
      // Download PDF from S3
      const pdfBuffer = await downloadFromS3(key);
      
      // Parse PDF text
      let pdfText = '';
      try {
        const pdfData = await pdfParse(pdfBuffer);
        pdfText = pdfData.text;
      } catch (pdfError) {
        console.log(`   ⚠️  Could not parse PDF text, using filename only`);
      }
      
      // Extract details using AI
      const details = await extractRFQDetails(pdfText, fileName);
      
      // Insert into simurgh.rfq_documents
      const result = await client`
        INSERT INTO simurgh.rfq_documents (
          file_name,
          s3_key,
          s3_url,
          file_size,
          mime_type,
          status,
          rfq_number,
          extracted_text,
          extracted_fields,
          due_date,
          contracting_office,
          created_at,
          updated_at
        ) VALUES (
          ${fileName},
          ${key},
          ${`https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`},
          ${s3Object.Size || 0},
          'application/pdf',
          ${details.status || 'pending'},
          ${details.documentNumber},
          ${pdfText.substring(0, 5000)},
          ${JSON.stringify(details)},
          ${details.dueDate ? new Date(details.dueDate) : null},
          ${details.vendorName},
          ${s3Object.LastModified ? new Date(s3Object.LastModified).toISOString() : new Date().toISOString()},
          ${new Date().toISOString()}
        )
        RETURNING id
      `;
      
      console.log(`   ✅ Imported as ID: ${result[0].id}`);
      console.log(`      Type: ${details.documentType}, Number: ${details.documentNumber || 'N/A'}`);
      imported++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   ❌ Failed to import ${fileName}:`, error);
      failed++;
    }
  }
  
  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📁 Total: ${pdfDocuments.length}`);
  
  // Show current totals
  const totals = await client`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
    FROM simurgh.rfq_documents
    WHERE file_name != 'email_ingestion_checkpoint'
  `;
  
  console.log('\n📈 Database Totals:');
  console.log(`   Total RFQs: ${totals[0].total}`);
  console.log(`   Processed: ${totals[0].processed}`);
  console.log(`   Pending: ${totals[0].pending}`);
  
  await client.end();
  process.exit(0);
}

// Run the import
importDocuments().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});