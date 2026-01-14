import { NextRequest, NextResponse } from "next/server";
import { createGraphClient, getMonitoredUserId } from "@/lib/microsoft-graph/auth";
import { fetchEmailAttachments, markEmailAsRead } from "@/lib/microsoft-graph/email-service";
import { detectDocumentType } from "@/lib/microsoft-graph/config";
import { uploadToS3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { rfqDocuments, governmentOrders, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { extractRfqFromPdf } from "@/lib/extraction/rfq-extractor";
import { extractPoFromPdf, isMainPoDocument } from "@/lib/extraction/po-extractor";
import { eq, sql } from "drizzle-orm";
import { sendRFQNotification } from "@/lib/email-notification";

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
}

interface AttachmentData {
  name?: string | null;
  size?: number | null;
  contentType?: string | null;
  contentBytes?: string | null;
}

/**
 * Check if an email has already been processed
 */
async function isEmailAlreadyProcessed(emailId: string): Promise<boolean> {
  const existingRfq = await db
    .select({ id: rfqDocuments.id })
    .from(rfqDocuments)
    .where(sql`${rfqDocuments.extractedFields}->>'emailId' = ${emailId}`)
    .limit(1);

  if (existingRfq.length > 0) return true;

  const existingPO = await db
    .select({ id: governmentOrders.id })
    .from(governmentOrders)
    .where(sql`${governmentOrders.extractedData}->>'emailId' = ${emailId}`)
    .limit(1);

  return existingPO.length > 0;
}

/**
 * Webhook endpoint for Microsoft Graph email notifications
 * POST /api/email/webhook - Receives notifications when new emails arrive
 */
export async function POST(request: NextRequest) {
  try {
    // Validate the webhook during subscription setup
    const validationToken = request.nextUrl.searchParams.get("validationToken");
    if (validationToken) {
      console.log("Webhook validation received");
      return new Response(validationToken, { status: 200 });
    }

    // Process the notification
    const body = await request.json();

    // Verify client state for security
    if (body.value?.[0]?.clientState !== "rfq-ingestion-webhook") {
      return NextResponse.json({ error: "Invalid client state" }, { status: 401 });
    }

    // Process each notification
    for (const notification of body.value || []) {
      if (notification.changeType === "created") {
        await processNewEmail(notification.resourceData);
      }
    }

    return NextResponse.json({ status: "processed" });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * Process a new email notification
 */
async function processNewEmail(resourceData: { id?: string }) {
  try {
    const messageId = resourceData.id;
    if (!messageId) return;

    const client = createGraphClient();
    const userId = await getMonitoredUserId(client);

    // Get the full message
    const message: EmailMessage = await client
      .api(`/users/${userId}/messages/${messageId}`)
      .select("id,subject,from,receivedDateTime,bodyPreview,hasAttachments,body")
      .get();

    // Check if it's from the expected sender
    const senderEmail = message.from?.emailAddress?.address?.toLowerCase();
    const expectedSender = process.env.RFQ_SENDER_EMAIL || "noreply@asrcfederal.com";
    if (senderEmail !== expectedSender.toLowerCase()) {
      console.log(`Email ${messageId} is not from ${expectedSender} (sender: ${senderEmail})`);
      return;
    }

    if (!message.hasAttachments) {
      console.log(`Email ${messageId} from asrcfederal has no attachments`);
      return;
    }

    // Check if already processed (deduplication)
    if (await isEmailAlreadyProcessed(messageId)) {
      console.log(`Email ${messageId} already processed, skipping`);
      await markEmailAsRead(client, userId, messageId);
      return;
    }

    // Detect document type from subject
    const detectedDoc = detectDocumentType(message.subject || "");
    console.log(`Webhook: Detected document type: ${detectedDoc.type}, number: ${detectedDoc.documentNumber}`);

    // Fetch attachments
    const attachments = await fetchEmailAttachments(client, userId, messageId);

    if (detectedDoc.type === "po") {
      // Process as Purchase Order
      await processPurchaseOrderEmail(attachments, message, messageId);
    } else {
      // Process as RFQ - first PDF only
      for (const attachment of attachments) {
        if (!attachment.name?.toLowerCase().endsWith('.pdf')) continue;

        const timestamp = Date.now();
        const s3Key = `rfqs/email/${timestamp}-${attachment.name}`;
        const buffer = Buffer.from(attachment.contentBytes!, "base64");

        await uploadToS3(s3Key, buffer, attachment.contentType || "application/pdf");
        await processRfqAttachment(buffer, s3Key, message, attachment, messageId);
        break; // Only process first PDF for RFQs
      }
    }

    // Mark email as read
    await markEmailAsRead(client, userId, messageId);

  } catch (error) {
    console.error("Error processing new email:", error);
  }
}

/**
 * Process an RFQ attachment
 */
async function processRfqAttachment(
  buffer: Buffer,
  s3Key: string,
  message: EmailMessage,
  attachment: AttachmentData,
  emailId: string
): Promise<void> {
  // Create database record first
  const [rfqDoc] = await db.insert(rfqDocuments).values({
    fileName: attachment.name!,
    s3Key,
    fileSize: attachment.size!,
    mimeType: attachment.contentType!,
    status: "processing",
    extractedFields: {
      emailId,
      emailSource: message.from?.emailAddress?.address,
      emailSenderName: message.from?.emailAddress?.name,
      emailSubject: message.subject,
      emailReceivedAt: message.receivedDateTime,
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
          emailId,
          emailSource: message.from?.emailAddress?.address,
          emailSubject: message.subject,
          emailReceivedAt: message.receivedDateTime,
        },
        rfqNumber: extraction.rfqNumber,
        dueDate: extraction.dueDate,
        contractingOffice: extraction.contractingOffice,
        status: "processed",
        updatedAt: new Date(),
      })
      .where(eq(rfqDocuments.id, rfqDoc.id));

    console.log(`Webhook: Successfully processed RFQ ${rfqDoc.id}`);

    // Send notification
    try {
      await sendRFQNotification({
        rfqNumber: extraction.rfqNumber,
        title: null,
        dueDate: extraction.dueDate,
        contractingOffice: extraction.contractingOffice,
        fileName: attachment.name!,
        emailSubject: message.subject,
        rfqId: rfqDoc.id,
      });
    } catch (e) {
      console.error("Failed to send RFQ notification:", e);
    }
  } else {
    await db.update(rfqDocuments)
      .set({
        extractedText: extraction.extractedText,
        status: "extraction_failed",
        processingError: extraction.error,
        updatedAt: new Date(),
      })
      .where(eq(rfqDocuments.id, rfqDoc.id));
  }
}

/**
 * Process a Purchase Order email
 */
async function processPurchaseOrderEmail(
  attachments: AttachmentData[],
  message: EmailMessage,
  emailId: string
): Promise<void> {
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
    console.log("Webhook: No main PO document found in attachments");
    return;
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
    await db.insert(governmentOrders).values({
      poNumber: "EXTRACTION_FAILED",
      productName: "Unknown - extraction failed",
      quantity: 1,
      originalPdfS3Key: mainPoS3Key,
      packingListS3Key,
      extractedData: {
        emailId,
        emailSource: message.from?.emailAddress?.address,
        emailSubject: message.subject,
        emailReceivedAt: message.receivedDateTime,
        extractionError: extraction.error,
      },
      status: "extraction_failed",
    });
    return;
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
      console.log(`Webhook: Auto-linked PO to RFQ: ${extraction.rfqNumber}`);
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
      emailId,
      emailSource: message.from?.emailAddress?.address,
      emailSubject: message.subject,
      emailReceivedAt: message.receivedDateTime,
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

  console.log(`Webhook: Processed PO ${extractedData.poNumber}, orderId: ${newOrder.id}`);
}

/**
 * GET endpoint to set up or renew webhook subscription
 */
export async function GET(request: NextRequest) {
  try {
    const client = createGraphClient();
    const userId = await getMonitoredUserId(client);

    // Get the public URL for this webhook
    const host = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const notificationUrl = `${protocol}://${host}/api/email/webhook`;

    // Check for existing subscriptions
    const subscriptions = await client
      .api("/subscriptions")
      .filter(`resource eq '/users/${userId}/mailFolders/inbox/messages'`)
      .get();

    if (subscriptions.value && subscriptions.value.length > 0) {
      // Renew existing subscription
      const subscription = subscriptions.value[0];
      const newExpiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      await client
        .api(`/subscriptions/${subscription.id}`)
        .patch({ expirationDateTime: newExpiration });

      return NextResponse.json({
        message: "Subscription renewed",
        subscriptionId: subscription.id,
        expiresAt: newExpiration,
      });
    } else {
      // Create new subscription
      const subscription = {
        changeType: "created",
        notificationUrl: notificationUrl,
        resource: `/users/${userId}/mailFolders/inbox/messages`,
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        clientState: "rfq-ingestion-webhook",
      };

      const result = await client.api("/subscriptions").post(subscription);

      return NextResponse.json({
        message: "Subscription created",
        subscriptionId: result.id,
        expiresAt: result.expirationDateTime,
      });
    }

  } catch (error) {
    console.error("Error managing subscription:", error);
    return NextResponse.json(
      { error: "Failed to manage subscription", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
