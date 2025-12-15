import { NextRequest, NextResponse } from "next/server";
import { createGraphClient, getMonitoredUserId } from "@/lib/microsoft-graph/auth";
import { fetchEmailAttachments, markEmailAsRead } from "@/lib/microsoft-graph/email-service";
import { EMAIL_CONFIG } from "@/lib/microsoft-graph/config";
import { uploadToS3, downloadFromS3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { 
  getIngestionCheckpoint, 
  calculateLookbackDate, 
  markIngestionSuccess, 
  markIngestionFailed 
} from "@/lib/email-ingestion-tracker";
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
 * Smart polling endpoint that tracks last successful run
 * GET /api/email/poll - Processes ONE email, starting from last checkpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Check for API key in headers for security
    const apiKey = request.headers.get("x-api-key");
    const expectedKey = process.env.EMAIL_POLL_API_KEY;
    
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get checkpoint and calculate lookback
    const checkpoint = await getIngestionCheckpoint();
    const lookback = calculateLookbackDate(checkpoint);
    
    console.log(`Smart email poll - ${lookback.reason}`);
    console.log(`Looking back ${lookback.lookbackDays} days from ${lookback.lookbackDate.toISOString()}`);
    
    const client = createGraphClient();
    const userId = await getMonitoredUserId(client);
    
    // Fetch recent emails without complex filter
    // We'll filter by sender and date in code to avoid Graph API restrictions
    const messages = await client
      .api(`/users/${userId}/mailFolders/inbox/messages`)
      .select("id,subject,from,receivedDateTime,bodyPreview,hasAttachments,body,isRead")
      .orderby("receivedDateTime desc") // Get most recent first
      .top(100) // Get last 100 emails
      .get();
    
    // Filter by sender, date and unread status in code
    const filteredMessages = (messages.value || [])
      .filter((m: any) => {
        const senderEmail = m.from?.emailAddress?.address?.toLowerCase();
        const expectedSender = EMAIL_CONFIG.RFQ_SENDER_EMAIL.toLowerCase();
        const emailDate = new Date(m.receivedDateTime);
        return senderEmail === expectedSender && 
               emailDate >= lookback.lookbackDate && 
               !m.isRead;
      })
      .sort((a: any, b: any) => {
        // Sort oldest first for processing
        return new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime();
      })
      .slice(0, 1); // Take only ONE email

    if (!filteredMessages || filteredMessages.length === 0) {
      // No new emails - mark as successful run
      await markIngestionSuccess();
      
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        emailsProcessed: 0,
        lookback: {
          days: lookback.lookbackDays,
          reason: lookback.reason,
        },
        message: "No new emails to process",
      });
    }

    const email = filteredMessages[0];
    
    // Skip if no attachments
    if (!email.hasAttachments) {
      // Mark as successful (we checked, just nothing to process)
      await markIngestionSuccess(new Date(email.receivedDateTime), email.id);
      
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        emailsProcessed: 0,
        skipped: 1,
        reason: "Email has no attachments",
        email: {
          subject: email.subject,
          from: email.from?.emailAddress?.address,
          receivedAt: email.receivedDateTime,
        },
      });
    }

    // Process the email with attachments
    const processedAttachments = [];
    
    try {
      const attachments = await fetchEmailAttachments(client, userId, email.id!);
      
      for (const attachment of attachments) {
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
            emailId: email.id,
            emailSource: email.from?.emailAddress?.address,
            emailSenderName: email.from?.emailAddress?.name,
            emailSubject: email.subject,
            emailReceivedAt: email.receivedDateTime,
            emailBodyPreview: email.bodyPreview,
          },
        }).returning();

        // Process PDF
        try {
          const pdfData = await pdfParse(buffer);
          const extractedText = pdfData.text;

          // Extract fields with AI
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Extract RFQ information and return as JSON. Include fields like rfqNumber, title, dueDate, contractingOffice, pocName, pocEmail, pocPhone, deliveryDate, deliveryLocation, paymentTerms, shippingTerms, items, etc.`
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
                emailId: email.id,
                emailSource: email.from?.emailAddress?.address,
                emailSenderName: email.from?.emailAddress?.name,
                emailSubject: email.subject,
                emailReceivedAt: email.receivedDateTime,
              },
              rfqNumber: normalizedRfqNumber,
              dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
              contractingOffice: extractedFields.contractingOffice || null,
              status: "processed",
              updatedAt: new Date(),
            })
            .where(eq(rfqDocuments.id, rfqDoc.id));

          processedAttachments.push({
            rfqId: rfqDoc.id,
            fileName: attachment.name,
            status: "processed",
          });

          // Send email notification for successfully processed RFQ
          await sendRFQNotification({
            rfqNumber: normalizedRfqNumber,
            title: extractedFields.title,
            dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
            contractingOffice: extractedFields.contractingOffice,
            fileName: attachment.name!,
            emailSubject: email.subject,
            rfqId: rfqDoc.id,
          });

        } catch (processingError) {
          console.error(`Error processing PDF:`, processingError);
          
          await db.update(rfqDocuments)
            .set({
              status: "failed",
              processingError: processingError instanceof Error ? processingError.message : String(processingError),
              updatedAt: new Date(),
            })
            .where(eq(rfqDocuments.id, rfqDoc.id));

          processedAttachments.push({
            rfqId: rfqDoc.id,
            fileName: attachment.name,
            status: "failed",
            error: processingError instanceof Error ? processingError.message : "Unknown error",
          });
        }
      }

      // Mark email as read if configured
      if (!email.isRead) {
        await markEmailAsRead(client, userId, email.id!);
      }

      // Mark ingestion as successful with last processed email info
      await markIngestionSuccess(new Date(email.receivedDateTime), email.id);

      return NextResponse.json({
        timestamp: new Date().toISOString(),
        emailsProcessed: 1,
        lookback: {
          days: lookback.lookbackDays,
          reason: lookback.reason,
        },
        email: {
          subject: email.subject,
          from: email.from?.emailAddress?.address,
          receivedAt: email.receivedDateTime,
          attachments: processedAttachments,
        },
      });

    } catch (error) {
      // Mark ingestion as failed
      await markIngestionFailed(error instanceof Error ? error.message : "Unknown error");
      
      throw error;
    }

  } catch (error) {
    console.error("Error polling emails:", error);
    
    // Try to mark as failed if not already done
    try {
      await markIngestionFailed(error instanceof Error ? error.message : "Unknown error");
    } catch {}
    
    return NextResponse.json(
      { 
        error: "Failed to poll emails", 
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
