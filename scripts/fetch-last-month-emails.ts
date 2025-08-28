// Load environment variables FIRST before any imports
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Now import everything else
import { createGraphClient, getMonitoredUserId } from "../lib/microsoft-graph/auth";
import { fetchEmailAttachments, markEmailAsRead } from "../lib/microsoft-graph/email-service";
import { uploadToS3 } from "../lib/aws/s3";
import { db } from "../lib/db";
import { rfqDocuments } from "../drizzle/migrations/schema";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function fetchLastMonthEmails() {
  console.log("🔍 Starting email fetch for last 30 days...");
  
  try {
    const client = createGraphClient();
    const userId = await getMonitoredUserId(client);
    
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFilter = thirtyDaysAgo.toISOString();
    
    console.log(`📅 Fetching emails since: ${dateFilter}`);
    console.log(`📧 Looking for emails from: ${process.env.RFQ_SENDER_EMAIL || 'noreply@asrcfederal.com'}`);
    
    // Fetch emails from the last 30 days
    const messages = await client
      .api(`/users/${userId}/mailFolders/inbox/messages`)
      .filter(`receivedDateTime ge ${dateFilter}`)
      .select("id,subject,from,receivedDateTime,bodyPreview,hasAttachments,body,isRead")
      .orderby("receivedDateTime desc")
      .top(999) // Get all emails from last month
      .get();
    
    // Filter for emails from the RFQ sender
    const expectedSender = (process.env.RFQ_SENDER_EMAIL || 'noreply@asrcfederal.com').toLowerCase();
    const rfqEmails = (messages.value || []).filter((email: any) => {
      const senderEmail = email.from?.emailAddress?.address?.toLowerCase();
      return senderEmail === expectedSender && email.hasAttachments;
    });
    
    console.log(`\n📊 Found ${rfqEmails.length} RFQ emails with attachments`);
    
    if (rfqEmails.length === 0) {
      console.log("❌ No RFQ emails found from the specified sender");
      return;
    }
    
    // Process each email
    for (let i = 0; i < rfqEmails.length; i++) {
      const email = rfqEmails[i];
      console.log(`\n📨 Processing email ${i + 1}/${rfqEmails.length}`);
      console.log(`   Subject: ${email.subject}`);
      console.log(`   Date: ${email.receivedDateTime}`);
      console.log(`   From: ${email.from?.emailAddress?.address}`);
      console.log(`   Read: ${email.isRead ? 'Yes' : 'No'}`);
      
      try {
        // Check if already processed
        const existing = await db.select()
          .from(rfqDocuments)
          .where(eq(rfqDocuments.extractedFields, { emailId: email.id }))
          .limit(1);
        
        if (existing.length > 0) {
          console.log(`   ⏭️  Already processed - skipping`);
          continue;
        }
        
        // Fetch attachments
        const attachments = await fetchEmailAttachments(client, userId, email.id);
        console.log(`   📎 Found ${attachments.length} attachments`);
        
        for (const attachment of attachments) {
          if (!attachment.name?.toLowerCase().endsWith('.pdf')) {
            console.log(`   ⏭️  Skipping non-PDF: ${attachment.name}`);
            continue;
          }
          
          console.log(`   📄 Processing: ${attachment.name} (${(attachment.size! / 1024).toFixed(2)} KB)`);
          
          // Upload to S3
          const timestamp = Date.now();
          const s3Key = `rfqs/email/${timestamp}-${attachment.name}`;
          const buffer = Buffer.from(attachment.contentBytes!, "base64");
          
          await uploadToS3(s3Key, buffer, attachment.contentType || "application/pdf");
          console.log(`   ☁️  Uploaded to S3: ${s3Key}`);
          
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
          
          console.log(`   💾 Created database record: ${rfqDoc.id}`);
          
          // Process PDF with AI
          try {
            const pdfData = await pdfParse(buffer);
            const extractedText = pdfData.text;
            console.log(`   📖 Extracted ${extractedText.length} characters of text`);
            
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
            console.log(`   🤖 AI extracted fields:`, Object.keys(extractedFields).join(', '));
            
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
                rfqNumber: extractedFields.rfqNumber || null,
                dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
                contractingOffice: extractedFields.contractingOffice || null,
                status: "processed",
                updatedAt: new Date(),
              })
              .where(eq(rfqDocuments.id, rfqDoc.id));
            
            console.log(`   ✅ Successfully processed RFQ: ${extractedFields.rfqNumber || 'Unknown'}`);
            
          } catch (processingError) {
            console.error(`   ❌ Error processing PDF:`, processingError);
            
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
        if (!email.isRead) {
          await markEmailAsRead(client, userId, email.id);
          console.log(`   ✉️  Marked email as read`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing email:`, error);
      }
    }
    
    // Summary
    const processed = await db.select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.status, "processed"));
    
    console.log(`\n✨ Completed email fetch!`);
    console.log(`   Total RFQs in database: ${processed.length}`);
    
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
fetchLastMonthEmails()
  .then(() => {
    console.log("\n🎉 Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });