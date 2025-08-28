import { NextRequest, NextResponse } from "next/server";
import { processRFQEmails } from "@/lib/microsoft-graph/email-service";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { downloadFromS3 } from "@/lib/aws/s3";
import pdfParse from "pdf-parse";
import OpenAI from "openai";

// Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Manual endpoint to trigger email ingestion
 * GET /api/email/ingest - Fetches and processes unread RFQ emails
 */
export async function GET(request: NextRequest) {
  try {
    console.log("Starting email ingestion process...");
    
    // Process emails from inbox
    const processedEmails = await processRFQEmails();
    
    if (processedEmails.length === 0) {
      return NextResponse.json({
        message: "No new RFQ emails found",
        processed: 0,
      });
    }

    const results = [];
    
    // Process each email and its attachments
    for (const email of processedEmails) {
      for (const attachment of email.attachments) {
        try {
          // Create database record with email metadata
          const [rfqDoc] = await db.insert(rfqDocuments).values({
            fileName: attachment.name,
            s3Key: attachment.s3Key,
            fileSize: attachment.size,
            mimeType: attachment.contentType,
            status: "processing",
            // Store email metadata in extractedFields
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
          const pdfData = await pdfParse(pdfBuffer);
          const extractedText = pdfData.text;

          // Use OpenAI to extract RFQ fields
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an expert at extracting information from RFQ (Request for Quote) documents. 
                Extract the following fields from the provided text and return them as JSON:
                - rfqNumber: The RFQ number or solicitation number
                - title: The title or description of the RFQ
                - dueDate: The response due date (ISO format if possible)
                - contractingOffice: The contracting office or agency
                - pocName: Point of contact name
                - pocEmail: Point of contact email
                - pocPhone: Point of contact phone
                - deliveryDate: Required delivery date
                - deliveryLocation: Delivery location
                - paymentTerms: Payment terms
                - shippingTerms: Shipping/FOB terms
                - requiredCertifications: Array of required certifications
                - specialClauses: Any special clauses or requirements
                - items: Array of line items with description, quantity, unit
                - hasCageCode: boolean - whether CAGE code is required
                - hasUnitCost: boolean - whether unit cost is required
                - hasDeliveryTime: boolean - whether delivery time is required
                - hasPaymentTerms: boolean - whether payment terms are required
                
                Also include the email metadata that was provided:
                - emailSource: "${email.sender}"
                - emailSenderName: "${email.senderName}"
                - emailSubject: "${email.subject}"
                - emailReceivedAt: "${email.receivedDateTime}"
                
                Return only valid JSON, no markdown formatting.`
              },
              {
                role: "user",
                content: extractedText.substring(0, 8000)
              }
            ],
            temperature: 0.3,
            max_tokens: 2000,
          });

          let extractedFields: any = {};
          try {
            const content = completion.choices[0].message.content || "{}";
            extractedFields = JSON.parse(content);
          } catch (e) {
            console.error("Failed to parse AI response:", e);
            extractedFields = { error: "Failed to parse fields" };
          }

          // Update database with extracted data
          await db.update(rfqDocuments)
            .set({
              extractedText: extractedText.substring(0, 10000),
              extractedFields,
              rfqNumber: extractedFields.rfqNumber || null,
              dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
              contractingOffice: extractedFields.contractingOffice || null,
              status: "processed",
              updatedAt: new Date(),
            })
            .where(eq(rfqDocuments.id, rfqDoc.id));

          results.push({
            rfqId: rfqDoc.id,
            fileName: attachment.name,
            emailSubject: email.subject,
            status: "processed",
          });

          // Send email notification for successfully processed RFQ
          await sendRFQNotification({
            rfqNumber: extractedFields.rfqNumber,
            title: extractedFields.title,
            dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
            contractingOffice: extractedFields.contractingOffice,
            fileName: attachment.name,
            emailSubject: email.subject,
            rfqId: rfqDoc.id,
          });

        } catch (error) {
          console.error(`Error processing attachment ${attachment.name}:`, error);
          results.push({
            fileName: attachment.name,
            emailSubject: email.subject,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    return NextResponse.json({
      message: `Processed ${processedEmails.length} emails with ${results.length} attachments`,
      emails: processedEmails.length,
      attachments: results,
    });

  } catch (error) {
    console.error("Error in email ingestion:", error);
    return NextResponse.json(
      { error: "Failed to ingest emails", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Import eq from drizzle-orm
import { eq } from "drizzle-orm";
import { sendRFQNotification } from "@/lib/email-notification";