import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, governmentOrders, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { downloadFromS3 } from "@/lib/aws/s3";
import { extractPoFromPdf } from "@/lib/extraction/po-extractor";
import { eq, sql, and, isNotNull } from "drizzle-orm";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Parse a price string that may contain commas, dollar signs, etc.
 */
function parsePrice(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value);
  const cleaned = str.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return num.toFixed(2);
}

/**
 * Migrate misplaced POs from rfq_documents to government_orders
 * POST /api/orders/migrate-misplaced
 */
export async function POST(request: NextRequest) {
  try {
    // Find PO files in rfq_documents
    const misplacedPOs = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        s3Key: rfqDocuments.s3Key,
        status: rfqDocuments.status,
        extractedFields: rfqDocuments.extractedFields,
      })
      .from(rfqDocuments)
      .where(eq(rfqDocuments.status, "failed"));

    // Filter to only PO-related files
    const poFiles = misplacedPOs.filter(r => {
      const fileName = r.fileName?.toLowerCase() || "";
      return fileName.includes("vendorpo") || fileName.includes("packinglist");
    });

    // Group by email ID to process vendorPO + packingList together
    const posByEmail = new Map<string, typeof poFiles>();
    for (const po of poFiles) {
      const fields = po.extractedFields as Record<string, unknown> | null;
      const emailId = (fields?.emailId as string) || `no-email-${po.id}`;
      const existing = posByEmail.get(emailId) || [];
      existing.push(po);
      posByEmail.set(emailId, existing);
    }

    const results: Array<{
      emailId: string;
      status: string;
      orderId?: number;
      poNumber?: string;
      error?: string;
    }> = [];

    for (const [emailId, poRecords] of posByEmail) {
      const vendorPO = poRecords.find(p => p.fileName?.toLowerCase().includes("vendorpo"));
      const packingList = poRecords.find(p => p.fileName?.toLowerCase().includes("packinglist"));

      if (!vendorPO || !vendorPO.s3Key) {
        results.push({
          emailId,
          status: "skipped",
          error: "No vendorPO found or missing S3 key",
        });
        continue;
      }

      try {
        // Download and extract vendorPO
        const pdfBuffer = await downloadFromS3(vendorPO.s3Key);
        const extraction = await extractPoFromPdf(pdfBuffer);

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

        // Preserve email metadata
        const emailMetadata = vendorPO.extractedFields as Record<string, unknown> || {};

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
          originalPdfS3Key: vendorPO.s3Key,
          packingListS3Key: packingList?.s3Key || null,
          extractedData: {
            ...extractedData,
            emailId: emailMetadata.emailId,
            emailSource: emailMetadata.emailSource,
            emailSubject: emailMetadata.emailSubject,
            emailReceivedAt: emailMetadata.emailReceivedAt,
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

        results.push({
          emailId,
          status: "success",
          orderId: newOrder.id,
          poNumber: extractedData.poNumber as string || undefined,
        });

      } catch (error) {
        results.push({
          emailId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;
    const failCount = results.filter(r => r.status !== "success").length;

    return NextResponse.json({
      message: `Migrated ${successCount} PO groups`,
      success: successCount,
      failed: failCount,
      results,
    });

  } catch (error) {
    console.error("Error migrating POs:", error);
    return NextResponse.json(
      { error: "Failed to migrate POs", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check misplaced PO count
 */
export async function GET(request: NextRequest) {
  try {
    const misplacedPOs = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        status: rfqDocuments.status,
      })
      .from(rfqDocuments)
      .where(eq(rfqDocuments.status, "failed"));

    const poFiles = misplacedPOs.filter(r => {
      const fileName = r.fileName?.toLowerCase() || "";
      return fileName.includes("vendorpo") || fileName.includes("packinglist");
    });

    return NextResponse.json({
      misplacedPOCount: poFiles.length,
      files: poFiles.map(f => ({ id: f.id, fileName: f.fileName })),
    });

  } catch (error) {
    console.error("Error checking misplaced POs:", error);
    return NextResponse.json(
      { error: "Failed to check misplaced POs" },
      { status: 500 }
    );
  }
}
