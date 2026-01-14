/**
 * Fix ingestion data:
 * 1. Re-process failed RFQs with fixed JSON parser
 * 2. Migrate misplaced POs from rfq_documents to government_orders
 * 3. Link RFQs to POs based on rfqNumber
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { rfqDocuments, governmentOrders, governmentOrderRfqLinks } from "../drizzle/migrations/schema";
import { downloadFromS3 } from "../lib/aws/s3";
import { extractRfqFromPdf } from "../lib/extraction/rfq-extractor";
import { extractPoFromPdf } from "../lib/extraction/po-extractor";
import { eq, sql, and, isNotNull } from "drizzle-orm";

/**
 * Parse a price string that may contain commas, dollar signs, etc.
 * Returns null if parsing fails or input is null/undefined
 */
function parsePrice(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value);
  // Remove dollar signs, commas, and whitespace
  const cleaned = str.replace(/[$,\s]/g, "");
  // Validate it's a valid number
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  // Return as decimal string
  return num.toFixed(2);
}

async function reprocessFailedRfqs() {
  console.log("\n=== Re-processing Failed RFQs ===\n");

  // Get failed RFQs that are actual RFQs (not misplaced POs)
  const failedRfqs = await db.execute(sql`
    SELECT id, file_name, s3_key, status,
           extracted_fields->>'emailSubject' as email_subject
    FROM simurgh.rfq_documents
    WHERE status IN ('failed', 'extraction_failed')
      AND created_at >= NOW() - INTERVAL '30 days'
      AND status != 'checkpoint'
      AND (extracted_fields->>'emailSubject' NOT ILIKE '%Purchase Order%' OR extracted_fields->>'emailSubject' IS NULL)
    ORDER BY created_at DESC
  `);

  const rfqs = (failedRfqs.rows || failedRfqs) as Array<{
    id: number;
    file_name: string;
    s3_key: string;
    email_subject: string;
  }>;

  console.log(`Found ${rfqs.length} failed RFQs to re-process\n`);

  let successCount = 0;
  let failCount = 0;

  for (const rfq of rfqs) {
    process.stdout.write(`Processing RFQ ${rfq.id} (${rfq.file_name})... `);

    try {
      // Download PDF from S3
      const pdfBuffer = await downloadFromS3(rfq.s3_key);

      // Re-extract with fixed parser
      const extraction = await extractRfqFromPdf(pdfBuffer);

      if (extraction.success) {
        // Get existing extracted_fields to preserve email metadata
        const [existing] = await db
          .select({ extractedFields: rfqDocuments.extractedFields })
          .from(rfqDocuments)
          .where(eq(rfqDocuments.id, rfq.id));

        const emailMetadata = existing?.extractedFields as Record<string, unknown> || {};

        await db.update(rfqDocuments)
          .set({
            extractedText: extraction.extractedText,
            extractedFields: {
              ...extraction.extractedFields,
              emailId: emailMetadata.emailId,
              emailSource: emailMetadata.emailSource,
              emailSenderName: emailMetadata.emailSenderName,
              emailSubject: emailMetadata.emailSubject,
              emailReceivedAt: emailMetadata.emailReceivedAt,
            },
            rfqNumber: extraction.rfqNumber,
            dueDate: extraction.dueDate,
            contractingOffice: extraction.contractingOffice,
            status: "processed",
            processingError: null,
            updatedAt: new Date(),
          })
          .where(eq(rfqDocuments.id, rfq.id));

        console.log(`✓ RFQ# ${extraction.rfqNumber || "unknown"}`);
        successCount++;
      } else {
        await db.update(rfqDocuments)
          .set({
            processingError: extraction.error,
            updatedAt: new Date(),
          })
          .where(eq(rfqDocuments.id, rfq.id));

        console.log(`✗ ${extraction.error}`);
        failCount++;
      }
    } catch (error) {
      console.log(`✗ ${error instanceof Error ? error.message : "Unknown error"}`);
      failCount++;
    }
  }

  console.log(`\nRFQ Re-processing complete: ${successCount} success, ${failCount} failed`);
  return { successCount, failCount };
}

async function migrateMisplacedPOs() {
  console.log("\n=== Migrating Misplaced POs ===\n");

  // Get misplaced POs grouped by email_id (each email has vendorPO + packingList)
  const misplacedPOs = await db.execute(sql`
    SELECT id, file_name, s3_key, status,
           extracted_fields->>'emailSubject' as email_subject,
           extracted_fields->>'emailId' as email_id,
           extracted_fields->>'emailSource' as email_source,
           extracted_fields->>'emailReceivedAt' as email_received_at,
           extracted_fields as extracted_fields_json
    FROM simurgh.rfq_documents
    WHERE extracted_fields->>'emailSubject' ILIKE '%Purchase Order%'
      AND created_at >= NOW() - INTERVAL '30 days'
      AND status != 'checkpoint'
    ORDER BY extracted_fields->>'emailId', file_name
  `);

  const pos = (misplacedPOs.rows || misplacedPOs) as Array<{
    id: number;
    file_name: string;
    s3_key: string;
    status: string;
    email_subject: string;
    email_id: string;
    email_source: string;
    email_received_at: string;
    extracted_fields_json: Record<string, unknown>;
  }>;

  console.log(`Found ${pos.length} misplaced PO records\n`);

  // Group by email_id to process vendorPO + packingList together
  const posByEmail = new Map<string, typeof pos>();
  for (const po of pos) {
    const existing = posByEmail.get(po.email_id) || [];
    existing.push(po);
    posByEmail.set(po.email_id, existing);
  }

  let successCount = 0;
  let failCount = 0;

  for (const [emailId, poRecords] of posByEmail) {
    const vendorPO = poRecords.find(p => p.file_name.toLowerCase().includes("vendorpo"));
    const packingList = poRecords.find(p => p.file_name.toLowerCase().includes("packinglist"));

    if (!vendorPO) {
      console.log(`Skipping email ${emailId} - no vendorPO found`);
      continue;
    }

    process.stdout.write(`Processing PO from ${vendorPO.email_subject}... `);

    try {
      // Download and extract vendorPO
      const pdfBuffer = await downloadFromS3(vendorPO.s3_key);
      const extraction = await extractPoFromPdf(pdfBuffer);

      // Move S3 keys to orders folder (just update the key reference, don't re-upload)
      const newMainPoS3Key = vendorPO.s3_key.replace("rfqs/email/", "orders/email/");
      const newPackingListS3Key = packingList ? packingList.s3_key.replace("rfqs/email/", "orders/email/") : null;

      // Try to link to RFQ
      let linkedRfqDocumentId: number | null = null;
      if (extraction.rfqNumber) {
        const [matchingRfq] = await db
          .select()
          .from(rfqDocuments)
          .where(eq(rfqDocuments.rfqNumber, extraction.rfqNumber))
          .limit(1);

        if (matchingRfq) {
          linkedRfqDocumentId = matchingRfq.id;
        }
      }

      // Create government_orders record
      const extractedData = extraction.extractedData || {};
      const [newOrder] = await db.insert(governmentOrders).values({
        poNumber: extraction.success ? (extractedData.poNumber || "UNKNOWN") : "EXTRACTION_FAILED",
        rfqNumber: extraction.rfqNumber,
        rfqDocumentId: linkedRfqDocumentId,
        productName: extractedData.productName || "Unknown Product",
        productDescription: extractedData.productDescription || null,
        grade: extractedData.grade || null,
        nsn: extractedData.nsn || null,
        nsnBarcode: extractedData.nsn ? String(extractedData.nsn).replace(/-/g, "") : null,
        quantity: extractedData.quantity || 1,
        unitOfMeasure: extractedData.unitOfMeasure || null,
        unitContents: extractedData.unitContents || null,
        unitPrice: parsePrice(extractedData.unitPrice),
        totalPrice: parsePrice(extractedData.totalPrice),
        spec: extractedData.spec || null,
        milStd: extractedData.milStd || null,
        shipToName: extractedData.shipToName || null,
        shipToAddress: extractedData.shipToAddress || null,
        deliveryDate: extractedData.deliveryDate ? new Date(extractedData.deliveryDate as string) : null,
        originalPdfS3Key: vendorPO.s3_key, // Keep original S3 key
        packingListS3Key: packingList?.s3_key || null,
        extractedData: {
          ...extractedData,
          emailId: vendorPO.email_id,
          emailSource: vendorPO.email_source,
          emailSubject: vendorPO.email_subject,
          emailReceivedAt: vendorPO.email_received_at,
          migratedFromRfqDocuments: true,
          originalRfqDocumentIds: poRecords.map(p => p.id),
        },
        status: extraction.success ? "pending" : "extraction_failed",
      }).returning();

      // Create RFQ link if found
      if (linkedRfqDocumentId) {
        await db.insert(governmentOrderRfqLinks).values({
          governmentOrderId: newOrder.id,
          rfqDocumentId: linkedRfqDocumentId,
        }).onConflictDoNothing();
      }

      // Delete the misplaced records from rfq_documents
      for (const record of poRecords) {
        await db.delete(rfqDocuments).where(eq(rfqDocuments.id, record.id));
      }

      const rfqLink = linkedRfqDocumentId ? ` → linked to RFQ ${extraction.rfqNumber}` : "";
      console.log(`✓ PO# ${extractedData.poNumber || newOrder.id}${rfqLink}`);
      successCount++;

    } catch (error) {
      console.log(`✗ ${error instanceof Error ? error.message : "Unknown error"}`);
      failCount++;
    }
  }

  console.log(`\nPO Migration complete: ${successCount} success, ${failCount} failed`);
  return { successCount, failCount };
}

async function linkExistingRfqsAndPos() {
  console.log("\n=== Linking RFQs and POs ===\n");

  // Find POs that have rfqNumber but aren't linked
  const unlinkedPOs = await db
    .select({
      id: governmentOrders.id,
      poNumber: governmentOrders.poNumber,
      rfqNumber: governmentOrders.rfqNumber,
      rfqDocumentId: governmentOrders.rfqDocumentId,
    })
    .from(governmentOrders)
    .where(and(
      isNotNull(governmentOrders.rfqNumber),
      sql`${governmentOrders.rfqDocumentId} IS NULL`
    ));

  console.log(`Found ${unlinkedPOs.length} POs with rfqNumber but no linked RFQ\n`);

  let linkedCount = 0;

  for (const po of unlinkedPOs) {
    if (!po.rfqNumber) continue;

    const [matchingRfq] = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.rfqNumber, po.rfqNumber))
      .limit(1);

    if (matchingRfq) {
      // Update the PO with the linked RFQ
      await db.update(governmentOrders)
        .set({ rfqDocumentId: matchingRfq.id })
        .where(eq(governmentOrders.id, po.id));

      // Create junction table entry
      await db.insert(governmentOrderRfqLinks).values({
        governmentOrderId: po.id,
        rfqDocumentId: matchingRfq.id,
      }).onConflictDoNothing();

      console.log(`Linked PO ${po.poNumber} → RFQ ${po.rfqNumber}`);
      linkedCount++;
    }
  }

  console.log(`\nLinking complete: ${linkedCount} new links created`);
  return { linkedCount };
}

async function main() {
  console.log("=".repeat(50));
  console.log("  FIX INGESTION DATA SCRIPT");
  console.log("=".repeat(50));

  try {
    const rfqResult = await reprocessFailedRfqs();
    const poResult = await migrateMisplacedPOs();
    const linkResult = await linkExistingRfqsAndPos();

    console.log("\n" + "=".repeat(50));
    console.log("  SUMMARY");
    console.log("=".repeat(50));
    console.log(`RFQs re-processed: ${rfqResult.successCount} success, ${rfqResult.failCount} failed`);
    console.log(`POs migrated: ${poResult.successCount} success, ${poResult.failCount} failed`);
    console.log(`RFQ-PO links created: ${linkResult.linkedCount}`);

  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
