import { NextRequest, NextResponse } from "next/server";
import { createGraphClient, getMonitoredUserId } from "@/lib/microsoft-graph/auth";
import { fetchEmailsFromDateRange, getEmailIngestionStats, isEmailAlreadyProcessed } from "@/lib/microsoft-graph/email-service-extended";
import { fetchEmailAttachments, markEmailAsRead } from "@/lib/microsoft-graph/email-service";
import { detectDocumentType } from "@/lib/microsoft-graph/config";
import { uploadToS3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { rfqDocuments, governmentOrders, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { extractRfqFromPdf } from "@/lib/extraction/rfq-extractor";
import { extractPoFromPdf, isMainPoDocument } from "@/lib/extraction/po-extractor";
import { eq } from "drizzle-orm";

// Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface EmailMessage {
  id?: string;
  subject?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  conversationId?: string;
}

interface AttachmentData {
  name?: string | null;
  size?: number | null;
  contentType?: string | null;
  contentBytes?: string | null;
}

/**
 * Test endpoint to check and process emails from the past N days
 * GET /api/email/test?days=10&process=true&includeRead=true
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysBack = parseInt(searchParams.get("days") || "10");
    const shouldProcess = searchParams.get("process") === "true";
    const includeRead = searchParams.get("includeRead") !== "false"; // Default true

    console.log(`Testing email ingestion for past ${daysBack} days`);

    // Get statistics first
    const stats = await getEmailIngestionStats(daysBack);

    if (!shouldProcess) {
      return NextResponse.json({
        message: "Email ingestion test - DRY RUN",
        daysSearched: daysBack,
        stats,
        note: "Add ?process=true to actually process the emails",
      });
    }

    // Process emails
    const client = createGraphClient();
    const userId = await getMonitoredUserId(client);

    const emails = await fetchEmailsFromDateRange(
      client,
      userId,
      daysBack,
      includeRead,
      100 // Process up to 100 emails
    ) as EmailMessage[];

    const results = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const email of emails) {
      // Skip if no attachments
      if (!email.hasAttachments) {
        skippedCount++;
        continue;
      }

      // Check if already processed
      const alreadyProcessed = await isEmailAlreadyProcessed(
        email.id!,
        email.subject || "",
        email.receivedDateTime || ""
      );

      if (alreadyProcessed) {
        results.push({
          emailId: email.id,
          subject: email.subject,
          status: "already_processed",
          isRead: email.isRead,
        });
        skippedCount++;
        continue;
      }

      try {
        // Detect document type from subject
        const detectedDoc = detectDocumentType(email.subject || "");
        console.log(`Test: Detected document type: ${detectedDoc.type}, subject: ${email.subject}`);

        // Fetch attachments
        const attachments = await fetchEmailAttachments(client, userId, email.id!) as AttachmentData[];

        if (detectedDoc.type === "po") {
          // Process as Purchase Order
          const result = await processPurchaseOrderEmail(attachments, email);
          results.push({
            ...result,
            emailId: email.id,
            subject: email.subject,
            isRead: email.isRead,
            receivedAt: email.receivedDateTime,
          });
          if (result.status === "processed") processedCount++;
        } else {
          // Process as RFQ - first PDF only
          for (const attachment of attachments) {
            if (!attachment.name?.toLowerCase().endsWith('.pdf')) continue;

            const timestamp = Date.now();
            const s3Key = `rfqs/email/${timestamp}-${attachment.name}`;
            const buffer = Buffer.from(attachment.contentBytes!, "base64");

            await uploadToS3(s3Key, buffer, attachment.contentType || "application/pdf");

            const result = await processRfqAttachment(buffer, s3Key, email, attachment);
            results.push({
              ...result,
              emailId: email.id,
              subject: email.subject,
              isRead: email.isRead,
              receivedAt: email.receivedDateTime,
            });
            if (result.status === "processed") processedCount++;
            break; // Only process first PDF for RFQs
          }
        }

        // Optionally mark as read
        if (!email.isRead && searchParams.get("markAsRead") === "true") {
          await markEmailAsRead(client, userId, email.id!);
        }

      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          subject: email.subject,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Processed emails from past ${daysBack} days`,
      daysSearched: daysBack,
      includeRead,
      initialStats: stats,
      processed: processedCount,
      skipped: skippedCount,
      results,
    });

  } catch (error) {
    console.error("Error in email test:", error);
    return NextResponse.json(
      {
        error: "Failed to test email ingestion",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * Process an RFQ attachment
 */
async function processRfqAttachment(
  buffer: Buffer,
  s3Key: string,
  email: EmailMessage,
  attachment: AttachmentData
): Promise<{ type: string; rfqId?: number; fileName: string; status: string; error?: string }> {
  // Create database record first
  const [rfqDoc] = await db.insert(rfqDocuments).values({
    fileName: attachment.name!,
    s3Key,
    fileSize: attachment.size!,
    mimeType: attachment.contentType!,
    status: "processing",
    extractedFields: {
      emailId: email.id,
      emailSource: email.from?.emailAddress?.address,
      emailSenderName: email.from?.emailAddress?.name,
      emailSubject: email.subject,
      emailReceivedAt: email.receivedDateTime,
      emailBodyPreview: email.bodyPreview,
      emailWasRead: email.isRead,
      conversationId: email.conversationId,
    },
  }).returning();

  // Extract using Gemini
  const extraction = await extractRfqFromPdf(buffer);

  if (extraction.success) {
    await db.update(rfqDocuments)
      .set({
        extractedText: extraction.extractedText,
        extractedFields: {
          ...extraction.extractedFields,
          emailId: email.id,
          emailSource: email.from?.emailAddress?.address,
          emailSubject: email.subject,
          emailReceivedAt: email.receivedDateTime,
          emailWasRead: email.isRead,
        },
        rfqNumber: extraction.rfqNumber,
        dueDate: extraction.dueDate,
        contractingOffice: extraction.contractingOffice,
        status: "processed",
        updatedAt: new Date(),
      })
      .where(eq(rfqDocuments.id, rfqDoc.id));

    return {
      type: "rfq",
      rfqId: rfqDoc.id,
      fileName: attachment.name!,
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
      fileName: attachment.name!,
      status: "extraction_failed",
      error: extraction.error,
    };
  }
}

/**
 * Process a Purchase Order email
 */
async function processPurchaseOrderEmail(
  attachments: AttachmentData[],
  email: EmailMessage
): Promise<{ type: string; orderId?: number; fileName: string; status: string; error?: string }> {
  // Separate main PO from packing lists
  let mainPoAttachment: AttachmentData | null = null;
  let packingListAttachment: AttachmentData | null = null;

  for (const att of attachments) {
    if (!att.name?.toLowerCase().endsWith('.pdf')) continue;

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
      fileName: attachments[0]?.name || "unknown",
      status: "skipped",
      error: "No main PO document found",
    };
  }

  const timestamp = Date.now();
  const mainPoBuffer = Buffer.from(mainPoAttachment.contentBytes!, "base64");
  const mainPoS3Key = `orders/email/${timestamp}-${mainPoAttachment.name}`;

  // Upload main PO
  await uploadToS3(mainPoS3Key, mainPoBuffer, mainPoAttachment.contentType || "application/pdf");

  // Upload packing list if present
  let packingListS3Key: string | null = null;
  if (packingListAttachment) {
    packingListS3Key = `orders/email/${timestamp}-${packingListAttachment.name}`;
    const packingListBuffer = Buffer.from(packingListAttachment.contentBytes!, "base64");
    await uploadToS3(packingListS3Key, packingListBuffer, packingListAttachment.contentType || "application/pdf");
  }

  // Extract PO data using Claude
  const extraction = await extractPoFromPdf(mainPoBuffer);

  if (!extraction.success) {
    // Create order record even if extraction failed
    const [failedOrder] = await db.insert(governmentOrders).values({
      poNumber: "EXTRACTION_FAILED",
      productName: "Unknown - extraction failed",
      quantity: 1,
      originalPdfS3Key: mainPoS3Key,
      packingListS3Key,
      extractedData: {
        emailId: email.id,
        emailSource: email.from?.emailAddress?.address,
        emailSubject: email.subject,
        emailReceivedAt: email.receivedDateTime,
        extractionError: extraction.error,
      },
      status: "extraction_failed",
    }).returning();

    return {
      type: "po",
      orderId: failedOrder.id,
      fileName: mainPoAttachment.name!,
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
      console.log(`Test: Auto-linked PO to RFQ: ${extraction.rfqNumber}`);
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
    originalPdfS3Key: mainPoS3Key,
    packingListS3Key,
    extractedData: {
      ...extractedData,
      emailId: email.id,
      emailSource: email.from?.emailAddress?.address,
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

  console.log(`Test: Processed PO ${extractedData.poNumber}, orderId: ${newOrder.id}`);

  return {
    type: "po",
    orderId: newOrder.id,
    fileName: mainPoAttachment.name!,
    status: "processed",
  };
}
