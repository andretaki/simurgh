import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { downloadFromS3 } from "@/lib/aws/s3";
import { extractRfqFromPdf } from "@/lib/extraction/rfq-extractor";
import { eq, sql, inArray } from "drizzle-orm";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Batch reprocess failed RFQs
 * POST /api/rfq/reprocess-failed
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get failed RFQs using Drizzle query builder
    const failedRfqs = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        s3Key: rfqDocuments.s3Key,
        status: rfqDocuments.status,
        extractedFields: rfqDocuments.extractedFields,
      })
      .from(rfqDocuments)
      .where(eq(rfqDocuments.status, "failed"))
      .limit(limit);

    const extractionFailed = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        s3Key: rfqDocuments.s3Key,
        status: rfqDocuments.status,
        extractedFields: rfqDocuments.extractedFields,
      })
      .from(rfqDocuments)
      .where(eq(rfqDocuments.status, "extraction_failed"))
      .limit(limit);

    // Combine and filter out POs (vendorPO, packingList files)
    const allFailed = [...failedRfqs, ...extractionFailed];
    const rfqs = allFailed.filter(r => {
      const fileName = r.fileName?.toLowerCase() || "";
      // Exclude PO-related files
      if (fileName.includes("vendorpo") || fileName.includes("packinglist")) {
        return false;
      }
      // Check email subject for Purchase Order
      const fields = r.extractedFields as Record<string, unknown> | null;
      const emailSubject = (fields?.emailSubject as string || "").toLowerCase();
      if (emailSubject.includes("purchase order")) {
        return false;
      }
      return true;
    });

    console.log(`Found ${rfqs.length} failed RFQs to reprocess`);

    const results: Array<{
      id: number;
      fileName: string;
      status: string;
      rfqNumber?: string | null;
      error?: string;
    }> = [];

    for (const rfq of rfqs) {
      try {
        if (!rfq.s3Key) {
          results.push({
            id: rfq.id,
            fileName: rfq.fileName || "unknown",
            status: "error",
            error: "No S3 key found",
          });
          continue;
        }

        // Download PDF from S3
        const pdfBuffer = await downloadFromS3(rfq.s3Key);

        // Re-extract with fixed parser
        const extraction = await extractRfqFromPdf(pdfBuffer);

        // Preserve existing email metadata
        const emailMetadata = rfq.extractedFields as Record<string, unknown> || {};

        if (extraction.success) {
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

          results.push({
            id: rfq.id,
            fileName: rfq.fileName || "unknown",
            status: "success",
            rfqNumber: extraction.rfqNumber,
          });
        } else {
          await db.update(rfqDocuments)
            .set({
              processingError: extraction.error,
              updatedAt: new Date(),
            })
            .where(eq(rfqDocuments.id, rfq.id));

          results.push({
            id: rfq.id,
            fileName: rfq.fileName || "unknown",
            status: "extraction_failed",
            error: extraction.error,
          });
        }
      } catch (error) {
        results.push({
          id: rfq.id,
          fileName: rfq.fileName || "unknown",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.status === "success").length;
    const failCount = results.filter(r => r.status !== "success").length;

    return NextResponse.json({
      message: `Reprocessed ${rfqs.length} failed RFQs`,
      success: successCount,
      failed: failCount,
      results,
    });

  } catch (error) {
    console.error("Error in batch reprocess:", error);
    return NextResponse.json(
      { error: "Failed to reprocess RFQs", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check failed RFQ count
 */
export async function GET(request: NextRequest) {
  try {
    // Use Drizzle query builder instead of raw SQL
    const failedRfqs = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        s3Key: rfqDocuments.s3Key,
        status: rfqDocuments.status,
        createdAt: rfqDocuments.createdAt,
      })
      .from(rfqDocuments)
      .where(eq(rfqDocuments.status, "failed"))
      .limit(50);

    const extractionFailedRfqs = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        s3Key: rfqDocuments.s3Key,
        status: rfqDocuments.status,
        createdAt: rfqDocuments.createdAt,
      })
      .from(rfqDocuments)
      .where(eq(rfqDocuments.status, "extraction_failed"))
      .limit(50);

    const allFailed = [...failedRfqs, ...extractionFailedRfqs];

    return NextResponse.json({
      failedCount: allFailed.length,
      statusFailed: failedRfqs.length,
      statusExtractionFailed: extractionFailedRfqs.length,
      rfqs: allFailed.map(r => ({
        id: r.id,
        fileName: r.fileName,
        status: r.status,
        createdAt: r.createdAt?.toISOString(),
      })),
    });

  } catch (error) {
    console.error("Error checking failed RFQs:", error);
    return NextResponse.json(
      { error: "Failed to check failed RFQs", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
