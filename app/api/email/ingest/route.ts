import { NextRequest, NextResponse } from "next/server";
import { processRFQEmails } from "@/lib/microsoft-graph/email-service";
import { detectDocumentType } from "@/lib/microsoft-graph/config";
import { db } from "@/lib/db";
import { rfqDocuments, governmentOrders, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { downloadFromS3 } from "@/lib/aws/s3";
import { extractRfqFromPdf } from "@/lib/extraction/rfq-extractor";
import { extractPoFromPdf, isMainPoDocument } from "@/lib/extraction/po-extractor";
import { eq } from "drizzle-orm";
import { sendRFQNotification } from "@/lib/email-notification";

// Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ProcessedAttachment {
  name: string;
  s3Key: string;
  size: number;
  contentType: string;
}

interface ProcessedEmail {
  subject: string;
  sender: string;
  senderName: string;
  receivedDateTime: string;
  bodyPreview: string;
  attachments: ProcessedAttachment[];
}

/**
 * Manual endpoint to trigger email ingestion
 * GET /api/email/ingest - Fetches and processes unread RFQ emails
 */
export async function GET(request: NextRequest) {
  try {
    console.log("Starting email ingestion process...");

    // Process emails from inbox
    const processedEmails = await processRFQEmails() as ProcessedEmail[];

    if (processedEmails.length === 0) {
      return NextResponse.json({
        message: "No new RFQ emails found",
        processed: 0,
      });
    }

    const results = [];

    // Process each email
    for (const email of processedEmails) {
      // Detect document type from subject
      const detectedDoc = detectDocumentType(email.subject || "");
      console.log(`Ingest: Detected document type: ${detectedDoc.type}, subject: ${email.subject}`);

      if (detectedDoc.type === "po") {
        // Process as Purchase Order
        const result = await processPurchaseOrderAttachments(email);
        results.push(result);
      } else {
        // Process as RFQ - first PDF only
        const firstPdfAttachment = email.attachments.find(a =>
          a.name.toLowerCase().endsWith('.pdf')
        );

        if (firstPdfAttachment) {
          const result = await processRfqAttachment(firstPdfAttachment, email);
          results.push(result);
        }
      }
    }

    return NextResponse.json({
      message: `Processed ${processedEmails.length} emails with ${results.length} documents`,
      emails: processedEmails.length,
      results,
    });

  } catch (error) {
    console.error("Error in email ingestion:", error);
    return NextResponse.json(
      { error: "Failed to ingest emails", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Process an RFQ attachment
 */
async function processRfqAttachment(
  attachment: ProcessedAttachment,
  email: ProcessedEmail
): Promise<{ type: string; rfqId?: number; fileName: string; status: string; error?: string }> {
  try {
    // Create database record with email metadata
    const [rfqDoc] = await db.insert(rfqDocuments).values({
      fileName: attachment.name,
      s3Key: attachment.s3Key,
      fileSize: attachment.size,
      mimeType: attachment.contentType,
      status: "processing",
      extractedFields: {
        emailSource: email.sender,
        emailSenderName: email.senderName,
        emailSubject: email.subject,
        emailReceivedAt: email.receivedDateTime,
        emailBodyPreview: email.bodyPreview,
      },
    }).returning();

    // Download and process the PDF
    const pdfBuffer = await downloadFromS3(attachment.s3Key);

    // Extract using Gemini
    const extraction = await extractRfqFromPdf(pdfBuffer);

    if (extraction.success) {
      await db.update(rfqDocuments)
        .set({
          extractedText: extraction.extractedText,
          extractedFields: {
            ...extraction.extractedFields,
            emailSource: email.sender,
            emailSenderName: email.senderName,
            emailSubject: email.subject,
            emailReceivedAt: email.receivedDateTime,
          },
          rfqNumber: extraction.rfqNumber,
          dueDate: extraction.dueDate,
          contractingOffice: extraction.contractingOffice,
          status: "processed",
          updatedAt: new Date(),
        })
        .where(eq(rfqDocuments.id, rfqDoc.id));

      // Send notification
      try {
        await sendRFQNotification({
          rfqNumber: extraction.rfqNumber,
          title: null,
          dueDate: extraction.dueDate,
          contractingOffice: extraction.contractingOffice,
          fileName: attachment.name,
          emailSubject: email.subject,
          rfqId: rfqDoc.id,
        });
      } catch (e) {
        console.error("Failed to send RFQ notification:", e);
      }

      return {
        type: "rfq",
        rfqId: rfqDoc.id,
        fileName: attachment.name,
        status: "processed",
      };
    } else {
      await db.update(rfqDocuments)
        .set({
          extractedText: extraction.extractedText,
          status: "extraction_failed",
          processingError: extraction.error,
          updatedAt: new Date(),
        })
        .where(eq(rfqDocuments.id, rfqDoc.id));

      return {
        type: "rfq",
        rfqId: rfqDoc.id,
        fileName: attachment.name,
        status: "extraction_failed",
        error: extraction.error,
      };
    }
  } catch (error) {
    console.error(`Error processing RFQ attachment ${attachment.name}:`, error);
    return {
      type: "rfq",
      fileName: attachment.name,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process Purchase Order attachments
 */
async function processPurchaseOrderAttachments(
  email: ProcessedEmail
): Promise<{ type: string; orderId?: number; fileName: string; status: string; error?: string }> {
  try {
    // Separate main PO from packing lists
    let mainPoAttachment: ProcessedAttachment | null = null;
    let packingListAttachment: ProcessedAttachment | null = null;

    for (const att of email.attachments) {
      if (!att.name.toLowerCase().endsWith('.pdf')) continue;

      if (isMainPoDocument(att.name)) {
        if (!mainPoAttachment) {
          mainPoAttachment = att;
        }
      } else {
        if (!packingListAttachment) {
          packingListAttachment = att;
        }
      }
    }

    if (!mainPoAttachment) {
      return {
        type: "po",
        fileName: email.attachments[0]?.name || "unknown",
        status: "skipped",
        error: "No main PO document found",
      };
    }

    // Download and extract PO data
    const pdfBuffer = await downloadFromS3(mainPoAttachment.s3Key);
    const extraction = await extractPoFromPdf(pdfBuffer);

    if (!extraction.success) {
      // Create order record even if extraction failed
      const [failedOrder] = await db.insert(governmentOrders).values({
        poNumber: "EXTRACTION_FAILED",
        productName: "Unknown - extraction failed",
        quantity: 1,
        originalPdfS3Key: mainPoAttachment.s3Key,
        packingListS3Key: packingListAttachment?.s3Key || null,
        extractedData: {
          emailSource: email.sender,
          emailSubject: email.subject,
          emailReceivedAt: email.receivedDateTime,
          extractionError: extraction.error,
        },
        status: "extraction_failed",
      }).returning();

      return {
        type: "po",
        orderId: failedOrder.id,
        fileName: mainPoAttachment.name,
        status: "extraction_failed",
        error: extraction.error,
      };
    }

    // Try to link to originating RFQ
    let linkedRfqDocumentId: number | null = null;
    if (extraction.rfqNumber) {
      const [matchingRfq] = await db
        .select()
        .from(rfqDocuments)
        .where(eq(rfqDocuments.rfqNumber, extraction.rfqNumber))
        .limit(1);

      if (matchingRfq) {
        linkedRfqDocumentId = matchingRfq.id;
        console.log(`Ingest: Auto-linked PO to RFQ: ${extraction.rfqNumber}`);
      }
    }

    // Create order record
    const extractedData = extraction.extractedData;
    const [newOrder] = await db.insert(governmentOrders).values({
      poNumber: extractedData.poNumber || "UNKNOWN",
      rfqNumber: extraction.rfqNumber,
      rfqDocumentId: linkedRfqDocumentId,
      productName: extractedData.productName || "Unknown Product",
      productDescription: extractedData.productDescription || null,
      grade: extractedData.grade || null,
      nsn: extractedData.nsn || null,
      nsnBarcode: extractedData.nsn ? extractedData.nsn.replace(/-/g, "") : null,
      quantity: extractedData.quantity || 1,
      unitOfMeasure: extractedData.unitOfMeasure || null,
      unitContents: extractedData.unitContents || null,
      unitPrice: extractedData.unitPrice || null,
      totalPrice: extractedData.totalPrice || null,
      spec: extractedData.spec || null,
      milStd: extractedData.milStd || null,
      shipToName: extractedData.shipToName || null,
      shipToAddress: extractedData.shipToAddress || null,
      deliveryDate: extractedData.deliveryDate ? new Date(extractedData.deliveryDate) : null,
      originalPdfS3Key: mainPoAttachment.s3Key,
      packingListS3Key: packingListAttachment?.s3Key || null,
      extractedData: {
        ...extractedData,
        emailSource: email.sender,
        emailSubject: email.subject,
        emailReceivedAt: email.receivedDateTime,
      },
      status: "pending",
    }).returning();

    // Create RFQ link in junction table
    if (linkedRfqDocumentId) {
      await db.insert(governmentOrderRfqLinks).values({
        governmentOrderId: newOrder.id,
        rfqDocumentId: linkedRfqDocumentId,
      });
    }

    console.log(`Ingest: Processed PO ${extractedData.poNumber}, orderId: ${newOrder.id}`);

    return {
      type: "po",
      orderId: newOrder.id,
      fileName: mainPoAttachment.name,
      status: "processed",
    };
  } catch (error) {
    console.error("Error processing PO attachments:", error);
    return {
      type: "po",
      fileName: email.attachments[0]?.name || "unknown",
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
