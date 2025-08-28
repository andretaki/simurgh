import { NextRequest, NextResponse } from "next/server";
import { createGraphClient, getMonitoredUserId } from "@/lib/microsoft-graph/auth";
import { fetchEmailsFromDateRange, getEmailIngestionStats, isEmailAlreadyProcessed } from "@/lib/microsoft-graph/email-service-extended";
import { fetchEmailAttachments, markEmailAsRead } from "@/lib/microsoft-graph/email-service";
import { uploadToS3, downloadFromS3 } from "@/lib/aws/s3";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import { eq } from "drizzle-orm";

// Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    );

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
        // Fetch attachments
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
              emailWasRead: email.isRead,
              conversationId: email.conversationId,
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
                  content: `Extract RFQ information and return as JSON. Include all relevant fields.`
                },
                {
                  role: "user",
                  content: extractedText.substring(0, 8000)
                }
              ],
              temperature: 0.3,
              max_tokens: 2000,
            });

            let content = completion.choices[0].message.content || "{}";
            // Remove markdown code blocks if present
            content = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
            const extractedFields = JSON.parse(content);

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
                  emailWasRead: email.isRead,
                },
                rfqNumber: extractedFields.rfqNumber || null,
                dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
                contractingOffice: extractedFields.contractingOffice || null,
                status: "processed",
                updatedAt: new Date(),
              })
              .where(eq(rfqDocuments.id, rfqDoc.id));

            processedCount++;

            results.push({
              rfqId: rfqDoc.id,
              emailId: email.id,
              subject: email.subject,
              fileName: attachment.name,
              status: "processed",
              isRead: email.isRead,
              receivedAt: email.receivedDateTime,
            });

          } catch (processingError) {
            console.error(`Error processing PDF:`, processingError);
            
            await db.update(rfqDocuments)
              .set({
                status: "failed",
                processingError: processingError instanceof Error ? processingError.message : String(processingError),
              })
              .where(eq(rfqDocuments.id, rfqDoc.id));

            results.push({
              rfqId: rfqDoc.id,
              emailId: email.id,
              subject: email.subject,
              fileName: attachment.name,
              status: "failed",
              error: processingError instanceof Error ? processingError.message : "Unknown error",
            });
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