import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { downloadFromS3, getPresignedDownloadUrl } from "@/lib/aws/s3";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { s3Key, fileName, fileSize, mimeType } = await request.json();

        // Send initial status
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'started', 
          message: 'Processing initiated' 
        })}\n\n`));

        if (!s3Key || !fileName) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            status: 'error', 
            message: 'Missing required fields' 
          })}\n\n`));
          controller.close();
          return;
        }

        // Create database record
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'database', 
          message: 'Creating database record' 
        })}\n\n`));

        const [rfqDoc] = await db.insert(rfqDocuments).values({
          fileName,
          s3Key,
          fileSize,
          mimeType,
          status: "processing",
        }).returning();

        // Download from S3
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'downloading', 
          message: 'Downloading PDF from storage',
          progress: 20 
        })}\n\n`));

        const pdfBuffer = await downloadFromS3(s3Key);
        
        // Extract text
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'extracting', 
          message: 'Extracting text from PDF',
          progress: 40 
        })}\n\n`));

        const pdfData = await pdfParse(pdfBuffer);
        const extractedText = pdfData.text;

        // AI Analysis
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'analyzing', 
          message: 'AI analyzing document fields',
          progress: 60 
        })}\n\n`));

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert at extracting information from RFQ documents. 
              Extract fields and return JSON with confidence scores (0-100) for each field:
              {
                "fields": {
                  "rfqNumber": { "value": "...", "confidence": 95 },
                  "title": { "value": "...", "confidence": 90 },
                  "dueDate": { "value": "ISO date", "confidence": 85 },
                  "contractingOffice": { "value": "...", "confidence": 88 },
                  "pocName": { "value": "...", "confidence": 92 },
                  "pocEmail": { "value": "...", "confidence": 95 },
                  "pocPhone": { "value": "...", "confidence": 87 },
                  "deliveryDate": { "value": "...", "confidence": 80 },
                  "deliveryLocation": { "value": "...", "confidence": 85 },
                  "paymentTerms": { "value": "...", "confidence": 90 },
                  "shippingTerms": { "value": "...", "confidence": 88 },
                  "requiredCertifications": { "value": ["..."], "confidence": 85 },
                  "specialClauses": { "value": "...", "confidence": 75 },
                  "items": { "value": [{"description":"...", "quantity":"...", "unit":"..."}], "confidence": 90 }
                },
                "documentType": "RFQ|RFP|RFI|Other",
                "complexity": "Low|Medium|High",
                "estimatedResponseTime": "hours"
              }`
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

        // Update database
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'saving', 
          message: 'Saving analysis results',
          progress: 80 
        })}\n\n`));

        const s3Url = await getPresignedDownloadUrl(s3Key);

        await db.update(rfqDocuments)
          .set({
            extractedText: extractedText.substring(0, 10000),
            extractedFields,
            s3Url,
            rfqNumber: extractedFields.fields?.rfqNumber?.value || null,
            dueDate: extractedFields.fields?.dueDate?.value ? new Date(extractedFields.fields.dueDate.value) : null,
            contractingOffice: extractedFields.fields?.contractingOffice?.value || null,
            status: "processed",
            updatedAt: new Date(),
          })
          .where(eq(rfqDocuments.id, rfqDoc.id));

        // Send completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'complete', 
          message: 'Processing complete',
          progress: 100,
          rfqId: rfqDoc.id,
          extractedFields,
          documentType: extractedFields.documentType,
          complexity: extractedFields.complexity,
          estimatedResponseTime: extractedFields.estimatedResponseTime
        })}\n\n`));

      } catch (error) {
        console.error("Processing error:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Processing failed' 
        })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}