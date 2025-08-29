#!/usr/bin/env npx tsx
/**
 * Extract detailed fields from RFQ PDFs using GPT-4 mini
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import postgres from 'postgres';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';

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

async function extractFieldsWithAI(pdfText: string, fileName: string, docType: string) {
  try {
    let systemPrompt = '';
    
    if (docType === 'RFQ') {
      systemPrompt = `Extract RFQ details from this document. Return JSON with:
      - companyName: The company requesting the quote
      - contactName: Contact person's name
      - contactEmail: Contact email
      - contactPhone: Contact phone
      - items: Array of {description, quantity, unit, partNumber}
      - deliveryDate: Required delivery date
      - deliveryLocation: Delivery address
      - specialRequirements: Any special requirements or notes
      - paymentTerms: Payment terms if mentioned
      - validityPeriod: How long the quote should be valid`;
    } else if (docType === 'PO') {
      systemPrompt = `Extract Purchase Order details. Return JSON with:
      - purchaseOrderNumber: PO number
      - vendorName: Vendor/supplier name
      - buyerName: Buyer company name
      - items: Array of {description, quantity, unitPrice, totalPrice, partNumber}
      - subtotal: Subtotal amount
      - tax: Tax amount
      - totalAmount: Total order amount
      - orderDate: Order date
      - deliveryDate: Expected delivery date
      - shippingAddress: Shipping address
      - billingAddress: Billing address
      - paymentTerms: Payment terms`;
    } else {
      systemPrompt = `Extract packing list details. Return JSON with:
      - packingListNumber: Packing list number
      - poNumber: Related PO number
      - shipDate: Ship date
      - carrier: Shipping carrier
      - trackingNumber: Tracking number
      - items: Array of {description, quantity, weight, dimensions}
      - totalWeight: Total shipment weight
      - numberOfPackages: Number of packages
      - shippingFrom: Origin address
      - shippingTo: Destination address`;
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}
          
          Important:
          - Extract ALL items/line items found in the document
          - If a field is not found, use null
          - Parse dates in ISO format (YYYY-MM-DD)
          - Include all quantities and units exactly as shown
          - For items, preserve the exact descriptions from the document`
        },
        {
          role: "user",
          content: `Filename: ${fileName}\n\nDocument text:\n${pdfText}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    });
    
    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('AI extraction error:', error);
    return null;
  }
}

async function processDocuments() {
  console.log('🤖 Extracting RFQ fields with GPT-4 mini...\n');
  
  // Get documents that need processing
  const documents = await client`
    SELECT id, file_name, s3_key, rfq_number, extracted_fields
    FROM simurgh.rfq_documents
    WHERE s3_key IS NOT NULL 
    AND s3_key != 'checkpoint'
    AND (
      extracted_fields IS NULL 
      OR extracted_fields::text = '{}'
      OR NOT (extracted_fields ? 'items')
    )
    ORDER BY created_at DESC
    LIMIT 10
  `;
  
  console.log(`Found ${documents.length} documents to process\n`);
  
  let processed = 0;
  let failed = 0;
  
  for (const doc of documents) {
    try {
      console.log(`📄 Processing ${doc.file_name}...`);
      
      // Determine document type
      let docType = 'Document';
      if (doc.file_name.includes('vendorRFQ')) {
        docType = 'RFQ';
      } else if (doc.file_name.includes('vendorPO')) {
        docType = 'PO';
      } else if (doc.file_name.includes('packingList')) {
        docType = 'PackingList';
      }
      
      // Download and parse PDF
      console.log(`   Downloading from S3...`);
      const pdfBuffer = await downloadFromS3(doc.s3_key);
      
      console.log(`   Parsing PDF...`);
      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text;
      
      if (!pdfText || pdfText.length < 10) {
        console.log(`   ⚠️  PDF has no text content`);
        failed++;
        continue;
      }
      
      console.log(`   Extracting with GPT-4 mini...`);
      const extractedFields = await extractFieldsWithAI(pdfText, doc.file_name, docType);
      
      if (!extractedFields) {
        console.log(`   ⚠️  Failed to extract fields`);
        failed++;
        continue;
      }
      
      // Add metadata
      const fullFields = {
        ...extractedFields,
        documentType: docType,
        documentNumber: doc.rfq_number,
        extractedAt: new Date().toISOString(),
        textLength: pdfText.length,
      };
      
      // Update database
      await client`
        UPDATE simurgh.rfq_documents
        SET 
          extracted_fields = ${JSON.stringify(fullFields)},
          extracted_text = ${pdfText.substring(0, 5000)},
          status = 'processed',
          updated_at = ${new Date().toISOString()}
        WHERE id = ${doc.id}
      `;
      
      console.log(`   ✅ Extracted successfully`);
      
      // Show sample of what was extracted
      if (fullFields.items && fullFields.items.length > 0) {
        console.log(`      Items: ${fullFields.items.length} items found`);
        console.log(`      First item: ${fullFields.items[0].description || 'N/A'}`);
      }
      if (fullFields.companyName || fullFields.vendorName) {
        console.log(`      Company: ${fullFields.companyName || fullFields.vendorName}`);
      }
      
      processed++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n📊 Extraction Summary:');
  console.log(`   ✅ Processed: ${processed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📁 Total: ${documents.length}`);
  
  // Show stats
  const stats = await client`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
      COUNT(CASE WHEN extracted_fields IS NOT NULL AND extracted_fields::text != '{}' THEN 1 END) as with_fields
    FROM simurgh.rfq_documents
    WHERE s3_key != 'checkpoint'
  `;
  
  console.log('\n📈 Database Status:');
  console.log(`   Total documents: ${stats[0].total}`);
  console.log(`   Processed: ${stats[0].processed}`);
  console.log(`   With extracted fields: ${stats[0].with_fields}`);
  
  await client.end();
  process.exit(0);
}

processDocuments().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});