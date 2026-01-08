import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, governmentOrders, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { downloadFromS3 } from "@/lib/aws/s3";
import { extractRfqFromPdf } from "@/lib/extraction/rfq-extractor";
import { extractPoFromPdf } from "@/lib/extraction/po-extractor";

export const dynamic = 'force-dynamic';

/**
 * Retry extraction for a failed document
 * POST /api/admin/email-status/retry
 * Body: { type: "rfq" | "po", id: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { type, id } = await request.json();

    if (!type || !id) {
      return NextResponse.json(
        { error: "Missing type or id" },
        { status: 400 }
      );
    }

    if (type === "rfq") {
      return await retryRfqExtraction(id);
    } else if (type === "po") {
      return await retryPoExtraction(id);
    } else {
      return NextResponse.json(
        { error: "Invalid type. Must be 'rfq' or 'po'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error retrying extraction:", error);
    return NextResponse.json(
      { error: "Failed to retry extraction", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function retryRfqExtraction(id: number) {
  // Get the RFQ document
  const [rfqDoc] = await db
    .select()
    .from(rfqDocuments)
    .where(eq(rfqDocuments.id, id))
    .limit(1);

  if (!rfqDoc) {
    return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
  }

  if (rfqDoc.status !== "extraction_failed") {
    return NextResponse.json(
      { error: "RFQ is not in extraction_failed status" },
      { status: 400 }
    );
  }

  // Download PDF from S3
  const pdfBuffer = await downloadFromS3(rfqDoc.s3Key);

  // Re-run extraction
  const extraction = await extractRfqFromPdf(pdfBuffer);

  if (extraction.success) {
    const existingFields = (rfqDoc.extractedFields as Record<string, unknown>) || {};

    await db.update(rfqDocuments)
      .set({
        extractedText: extraction.extractedText,
        extractedFields: {
          ...extraction.extractedFields,
          emailId: existingFields.emailId,
          emailSource: existingFields.emailSource,
          emailSubject: existingFields.emailSubject,
          emailReceivedAt: existingFields.emailReceivedAt,
          retried: true,
          retriedAt: new Date().toISOString(),
        },
        rfqNumber: extraction.rfqNumber,
        dueDate: extraction.dueDate,
        contractingOffice: extraction.contractingOffice,
        status: "processed",
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(rfqDocuments.id, id));

    return NextResponse.json({
      success: true,
      message: "RFQ extraction succeeded",
      rfqNumber: extraction.rfqNumber,
    });
  } else {
    await db.update(rfqDocuments)
      .set({
        processingError: extraction.error,
        updatedAt: new Date(),
      })
      .where(eq(rfqDocuments.id, id));

    return NextResponse.json({
      success: false,
      message: "RFQ extraction failed again",
      error: extraction.error,
    });
  }
}

async function retryPoExtraction(id: number) {
  // Get the PO document
  const [order] = await db
    .select()
    .from(governmentOrders)
    .where(eq(governmentOrders.id, id))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 });
  }

  if (order.status !== "extraction_failed") {
    return NextResponse.json(
      { error: "PO is not in extraction_failed status" },
      { status: 400 }
    );
  }

  if (!order.originalPdfS3Key) {
    return NextResponse.json(
      { error: "No PDF associated with this order" },
      { status: 400 }
    );
  }

  // Download PDF from S3
  const pdfBuffer = await downloadFromS3(order.originalPdfS3Key);

  // Re-run extraction
  const extraction = await extractPoFromPdf(pdfBuffer);

  if (extraction.success) {
    const existingData = (order.extractedData as Record<string, unknown>) || {};

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

    const extractedData = extraction.extractedData;

    await db.update(governmentOrders)
      .set({
        poNumber: extractedData.poNumber || order.poNumber,
        rfqNumber: extraction.rfqNumber,
        rfqDocumentId: linkedRfqDocumentId,
        productName: extractedData.productName || order.productName,
        productDescription: extractedData.productDescription || null,
        grade: extractedData.grade || null,
        nsn: extractedData.nsn || null,
        nsnBarcode: extractedData.nsn ? extractedData.nsn.replace(/-/g, "") : null,
        quantity: extractedData.quantity || order.quantity,
        unitOfMeasure: extractedData.unitOfMeasure || null,
        unitContents: extractedData.unitContents || null,
        unitPrice: extractedData.unitPrice || null,
        totalPrice: extractedData.totalPrice || null,
        spec: extractedData.spec || null,
        milStd: extractedData.milStd || null,
        shipToName: extractedData.shipToName || null,
        shipToAddress: extractedData.shipToAddress || null,
        deliveryDate: extractedData.deliveryDate ? new Date(extractedData.deliveryDate) : null,
        extractedData: {
          ...extractedData,
          emailId: existingData.emailId,
          emailSource: existingData.emailSource,
          emailSubject: existingData.emailSubject,
          emailReceivedAt: existingData.emailReceivedAt,
          retried: true,
          retriedAt: new Date().toISOString(),
        },
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(governmentOrders.id, id));

    // Create RFQ link if found
    if (linkedRfqDocumentId) {
      await db.insert(governmentOrderRfqLinks).values({
        governmentOrderId: id,
        rfqDocumentId: linkedRfqDocumentId,
      }).onConflictDoNothing();
    }

    return NextResponse.json({
      success: true,
      message: "PO extraction succeeded",
      poNumber: extractedData.poNumber,
      rfqNumber: extraction.rfqNumber,
    });
  } else {
    const existingData = (order.extractedData as Record<string, unknown>) || {};

    await db.update(governmentOrders)
      .set({
        extractedData: {
          ...existingData,
          extractionError: extraction.error,
          lastRetryAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(governmentOrders.id, id));

    return NextResponse.json({
      success: false,
      message: "PO extraction failed again",
      error: extraction.error,
    });
  }
}
