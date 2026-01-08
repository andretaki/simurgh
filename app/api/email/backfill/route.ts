import { NextRequest, NextResponse } from "next/server";
import { createGraphClient, getMonitoredUserId } from "@/lib/microsoft-graph/auth";
import { fetchEmailAttachments, markEmailAsRead } from "@/lib/microsoft-graph/email-service";
import { EMAIL_CONFIG, detectDocumentType } from "@/lib/microsoft-graph/config";
import { uploadToS3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { rfqDocuments, governmentOrders, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { extractRfqFromPdf } from "@/lib/extraction/rfq-extractor";
import { extractPoFromPdf, isMainPoDocument } from "@/lib/extraction/po-extractor";
import { eq, sql } from "drizzle-orm";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

interface BackfillResult {
  emailId: string;
  subject: string;
  receivedAt: string;
  documentType: string;
  status: "processed" | "skipped" | "failed";
  skippedReason?: string;
  orderId?: number;
  rfqId?: number;
  packingListStored?: boolean;
  error?: string;
}

async function isEmailAlreadyProcessed(emailId: string): Promise<{ processed: boolean; type?: "rfq" | "po" }> {
  const existingRfq = await db
    .select({ id: rfqDocuments.id })
    .from(rfqDocuments)
    .where(sql`${rfqDocuments.extractedFields}->>'emailId' = ${emailId}`)
    .limit(1);

  if (existingRfq.length > 0) {
    return { processed: true, type: "rfq" };
  }

  const existingPO = await db
    .select({ id: governmentOrders.id })
    .from(governmentOrders)
    .where(sql`${governmentOrders.extractedData}->>'emailId' = ${emailId}`)
    .limit(1);

  if (existingPO.length > 0) {
    return { processed: true, type: "po" };
  }

  return { processed: false };
}

/**
 * Backfill endpoint to pull past N days of emails
 * GET /api/email/backfill?days=30&dryRun=true
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    const expectedKey = process.env.EMAIL_POLL_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 90);
    const dryRun = searchParams.get("dryRun") === "true";
    const markRead = searchParams.get("markRead") === "true";
    const skipProcessed = searchParams.get("skipProcessed") !== "false";

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - days);

    console.log(`Backfill: Looking back ${days} days, dryRun: ${dryRun}`);

    const client = createGraphClient();
    const userId = await getMonitoredUserId(client);

    const messages = await client
      .api(`/users/${userId}/mailFolders/inbox/messages`)
      .select("id,subject,from,receivedDateTime,bodyPreview,hasAttachments,isRead")
      .orderby("receivedDateTime desc")
      .top(500)
      .get();

    const filteredMessages = (messages.value || [])
      .filter((m: any) => {
        const senderEmail = m.from?.emailAddress?.address?.toLowerCase();
        const expectedSender = EMAIL_CONFIG.RFQ_SENDER_EMAIL.toLowerCase();
        const emailDate = new Date(m.receivedDateTime);
        return senderEmail === expectedSender && emailDate >= lookbackDate;
      })
      .sort((a: any, b: any) => {
        return new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime();
      });

    console.log(`Found ${filteredMessages.length} emails from ${EMAIL_CONFIG.RFQ_SENDER_EMAIL}`);

    // Check which emails are already processed
    const emailsWithStatus = await Promise.all(
      filteredMessages.map(async (email: any) => {
        const detected = detectDocumentType(email.subject || "");
        const alreadyProcessed = skipProcessed ? await isEmailAlreadyProcessed(email.id) : { processed: false };
        return {
          id: email.id,
          subject: email.subject,
          receivedAt: email.receivedDateTime,
          documentType: detected.type,
          documentNumber: detected.documentNumber,
          hasAttachments: email.hasAttachments,
          isRead: email.isRead,
          alreadyProcessed: alreadyProcessed.processed,
          existingType: alreadyProcessed.type,
        };
      })
    );

    if (dryRun) {
      const toProcess = emailsWithStatus.filter(e => !e.alreadyProcessed && e.hasAttachments);
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        dryRun: true,
        days,
        summary: {
          total: emailsWithStatus.length,
          toProcess: toProcess.length,
          alreadyProcessed: emailsWithStatus.filter(e => e.alreadyProcessed).length,
          rfqs: toProcess.filter(e => e.documentType === "rfq").length,
          pos: toProcess.filter(e => e.documentType === "po").length,
        },
        emails: emailsWithStatus,
      });
    }

    // Process emails
    const results: BackfillResult[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const emailStatus of emailsWithStatus) {
      const email = filteredMessages.find((m: any) => m.id === emailStatus.id);

      if (emailStatus.alreadyProcessed) {
        results.push({
          emailId: email.id,
          subject: email.subject,
          receivedAt: email.receivedDateTime,
          documentType: emailStatus.documentType,
          status: "skipped",
          skippedReason: `Already processed as ${emailStatus.existingType}`,
        });
        skippedCount++;
        continue;
      }

      if (!email.hasAttachments) {
        results.push({
          emailId: email.id,
          subject: email.subject,
          receivedAt: email.receivedDateTime,
          documentType: emailStatus.documentType,
          status: "skipped",
          skippedReason: "No attachments",
        });
        skippedCount++;
        continue;
      }

      try {
        const attachments = await fetchEmailAttachments(client, userId, email.id!);
        const detected = detectDocumentType(email.subject || "");

        let result: BackfillResult;

        if (detected.type === "po") {
          result = await processPO(attachments, email);
        } else {
          result = await processRFQ(attachments, email);
        }

        results.push(result);
        if (result.status === "processed") processedCount++;
        else if (result.status === "failed") errorCount++;
        else skippedCount++;

        if (markRead && !email.isRead) {
          await markEmailAsRead(client, userId, email.id!);
        }

      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        errorCount++;
        results.push({
          emailId: email.id,
          subject: email.subject,
          receivedAt: email.receivedDateTime,
          documentType: emailStatus.documentType,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      days,
      summary: {
        total: emailsWithStatus.length,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      results,
    });

  } catch (error) {
    console.error("Error in backfill:", error);
    return NextResponse.json(
      { error: "Failed to backfill", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ===============================
// Processing helpers
// ===============================

interface EmailData {
  id?: string;
  subject?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime?: string;
}

interface AttachmentData {
  name?: string | null;
  size?: number | null;
  contentType?: string | null;
  contentBytes?: string | null;
}

async function processRFQ(attachments: AttachmentData[], email: EmailData): Promise<BackfillResult> {
  const pdfAttachment = attachments.find(a => a.name?.toLowerCase().endsWith('.pdf'));
  if (!pdfAttachment) {
    return {
      emailId: email.id!,
      subject: email.subject || "",
      receivedAt: email.receivedDateTime || "",
      documentType: "rfq",
      status: "skipped",
      skippedReason: "No PDF attachment",
    };
  }

  const timestamp = Date.now();
  const s3Key = `rfqs/email/${timestamp}-${pdfAttachment.name}`;
  const buffer = Buffer.from(pdfAttachment.contentBytes!, "base64");

  await uploadToS3(s3Key, buffer, pdfAttachment.contentType || "application/pdf");

  // Create record first
  const [rfqDoc] = await db.insert(rfqDocuments).values({
    fileName: pdfAttachment.name!,
    s3Key,
    fileSize: pdfAttachment.size!,
    mimeType: pdfAttachment.contentType!,
    status: "processing",
    extractedFields: {
      emailId: email.id,
      emailSource: email.from?.emailAddress?.address,
      emailSubject: email.subject,
      emailReceivedAt: email.receivedDateTime,
      backfilled: true,
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
          backfilled: true,
        },
        rfqNumber: extraction.rfqNumber,
        dueDate: extraction.dueDate,
        contractingOffice: extraction.contractingOffice,
        status: "processed",
        updatedAt: new Date(),
      })
      .where(eq(rfqDocuments.id, rfqDoc.id));

    return {
      emailId: email.id!,
      subject: email.subject || "",
      receivedAt: email.receivedDateTime || "",
      documentType: "rfq",
      status: "processed",
      rfqId: rfqDoc.id,
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
      emailId: email.id!,
      subject: email.subject || "",
      receivedAt: email.receivedDateTime || "",
      documentType: "rfq",
      status: "failed",
      rfqId: rfqDoc.id,
      error: extraction.error,
    };
  }
}

async function processPO(attachments: AttachmentData[], email: EmailData): Promise<BackfillResult> {
  let mainPoAttachment: AttachmentData | null = null;
  let packingListAttachment: AttachmentData | null = null;

  for (const att of attachments) {
    if (!att.name?.toLowerCase().endsWith('.pdf')) continue;
    if (isMainPoDocument(att.name)) {
      if (!mainPoAttachment) mainPoAttachment = att;
    } else {
      if (!packingListAttachment) packingListAttachment = att;
    }
  }

  if (!mainPoAttachment) {
    return {
      emailId: email.id!,
      subject: email.subject || "",
      receivedAt: email.receivedDateTime || "",
      documentType: "po",
      status: "skipped",
      skippedReason: "No main PO document found",
    };
  }

  const timestamp = Date.now();
  const mainPoBuffer = Buffer.from(mainPoAttachment.contentBytes!, "base64");
  const mainPoS3Key = `orders/email/${timestamp}-${mainPoAttachment.name}`;

  await uploadToS3(mainPoS3Key, mainPoBuffer, mainPoAttachment.contentType || "application/pdf");

  let packingListS3Key: string | null = null;
  if (packingListAttachment) {
    packingListS3Key = `orders/email/${timestamp}-${packingListAttachment.name}`;
    const packingListBuffer = Buffer.from(packingListAttachment.contentBytes!, "base64");
    await uploadToS3(packingListS3Key, packingListBuffer, packingListAttachment.contentType || "application/pdf");
  }

  const extraction = await extractPoFromPdf(mainPoBuffer);

  if (!extraction.success) {
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
        backfilled: true,
      },
      status: "extraction_failed",
    }).returning();

    return {
      emailId: email.id!,
      subject: email.subject || "",
      receivedAt: email.receivedDateTime || "",
      documentType: "po",
      status: "failed",
      orderId: failedOrder.id,
      packingListStored: !!packingListS3Key,
      error: extraction.error,
    };
  }

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
      backfilled: true,
    },
    status: "pending",
  }).returning();

  if (linkedRfqDocumentId) {
    await db.insert(governmentOrderRfqLinks).values({
      governmentOrderId: newOrder.id,
      rfqDocumentId: linkedRfqDocumentId,
    });
  }

  return {
    emailId: email.id!,
    subject: email.subject || "",
    receivedAt: email.receivedDateTime || "",
    documentType: "po",
    status: "processed",
    orderId: newOrder.id,
    packingListStored: !!packingListS3Key,
  };
}
