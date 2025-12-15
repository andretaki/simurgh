import { NextRequest, NextResponse } from "next/server";
import { createGraphClient, getMonitoredUserId } from "@/lib/microsoft-graph/auth";
import { fetchEmailAttachments, markEmailAsRead } from "@/lib/microsoft-graph/email-service";
import { uploadToS3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import { normalizeRfqNumber } from "@/lib/rfq-number";
import { eq } from "drizzle-orm";
import { sendRFQNotification } from "@/lib/email-notification";

// Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
async function processNewEmail(resourceData: any) {
  try {
    const messageId = resourceData.id;
    if (!messageId) return;

    const client = createGraphClient();
    const userId = await getMonitoredUserId(client);

    // Get the full message
    const message = await client
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

    // Fetch and process attachments
    const attachments = await fetchEmailAttachments(client, userId, messageId);
    
    for (const attachment of attachments) {
      if (attachment.contentType !== "application/pdf" && !attachment.name?.toLowerCase().endsWith(".pdf")) {
        continue;
      }

      // Upload to S3
      const timestamp = Date.now();
      const s3Key = `rfqs/email/${timestamp}-${attachment.name}`;
      const buffer = Buffer.from(attachment.contentBytes!, "base64");
      
      await uploadToS3(s3Key, buffer, attachment.contentType || "application/pdf");

      // Create database record
      const [rfqDoc] = await db.insert(rfqDocuments).values({
        fileName: attachment.name!,
        s3Key,
        fileSize: attachment.size!,
        mimeType: attachment.contentType!,
        status: "processing",
        extractedFields: {
          emailSource: message.from?.emailAddress?.address,
          emailSenderName: message.from?.emailAddress?.name,
          emailSubject: message.subject,
          emailReceivedAt: message.receivedDateTime,
          emailBodyPreview: message.bodyPreview,
        },
      }).returning();

      // Process the PDF
      try {
        const pdfData = await pdfParse(buffer);
        const extractedText = pdfData.text;

        // Extract fields with OpenAI
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Extract RFQ information and return as JSON. Include fields like rfqNumber, title, dueDate, contractingOffice, pocName, pocEmail, pocPhone, deliveryDate, deliveryLocation, paymentTerms, shippingTerms, items, etc. Also preserve the email metadata.`
            },
            {
              role: "user",
              content: extractedText.substring(0, 8000)
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        });

        const extractedFields = JSON.parse(completion.choices[0].message.content || "{}");
        const normalizedRfqNumber = normalizeRfqNumber(extractedFields.rfqNumber);

        // Update database
        await db.update(rfqDocuments)
          .set({
            extractedText: extractedText.substring(0, 10000),
            extractedFields: {
              ...extractedFields,
              emailSource: message.from?.emailAddress?.address,
              emailSenderName: message.from?.emailAddress?.name,
              emailSubject: message.subject,
              emailReceivedAt: message.receivedDateTime,
            },
            rfqNumber: normalizedRfqNumber,
            dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
            contractingOffice: extractedFields.contractingOffice || null,
            status: "processed",
            updatedAt: new Date(),
          })
          .where(eq(rfqDocuments.id, rfqDoc.id));

        console.log(`Successfully processed RFQ ${rfqDoc.id} from email`);

        // Send email notification for successfully processed RFQ
        await sendRFQNotification({
          rfqNumber: normalizedRfqNumber,
          title: extractedFields.title,
          dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
          contractingOffice: extractedFields.contractingOffice,
          fileName: attachment.name!,
          emailSubject: message.subject,
          rfqId: rfqDoc.id,
        });

      } catch (processingError) {
        console.error(`Error processing PDF for RFQ ${rfqDoc.id}:`, processingError);
        
        await db.update(rfqDocuments)
          .set({
            status: "failed",
            processingError: processingError instanceof Error ? processingError.message : String(processingError),
            updatedAt: new Date(),
          })
          .where(eq(rfqDocuments.id, rfqDoc.id));
      }
    }

    // Mark email as read
    await markEmailAsRead(client, userId, messageId);

  } catch (error) {
    console.error("Error processing new email:", error);
  }
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
