import { NextRequest, NextResponse } from "next/server";
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
  try {
    const { s3Key, fileName, fileSize, mimeType } = await request.json();

    if (!s3Key || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create initial database record
    const [rfqDoc] = await db.insert(rfqDocuments).values({
      fileName,
      s3Key,
      fileSize,
      mimeType,
      status: "processing",
    }).returning();

    try {
      // Download PDF from S3
      const pdfBuffer = await downloadFromS3(s3Key);
      
      // Extract text from PDF
      const pdfData = await pdfParse(pdfBuffer);
      const extractedText = pdfData.text;

      // Use OpenAI to identify fields
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
            - requiredCertifications: Array of required certifications (8a, woman-owned, etc.)
            - specialClauses: Any special clauses or requirements
            - items: Array of line items with description, quantity, unit
            - hasCageCode: boolean - whether CAGE code is required
            - hasUnitCost: boolean - whether unit cost is required
            - hasDeliveryTime: boolean - whether delivery time is required
            - hasPaymentTerms: boolean - whether payment terms are required
            
            Return only valid JSON, no markdown formatting.`
          },
          {
            role: "user",
            content: extractedText.substring(0, 8000) // Limit to avoid token limits
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

      // Get presigned URL for accessing the PDF
      const s3Url = await getPresignedDownloadUrl(s3Key);

      // Update database with extracted data
      await db.update(rfqDocuments)
        .set({
          extractedText: extractedText.substring(0, 10000), // Store first 10k chars
          extractedFields,
          s3Url,
          rfqNumber: extractedFields.rfqNumber || null,
          dueDate: extractedFields.dueDate ? new Date(extractedFields.dueDate) : null,
          contractingOffice: extractedFields.contractingOffice || null,
          status: "processed",
          updatedAt: new Date(),
        })
        .where(eq(rfqDocuments.id, rfqDoc.id));

      return NextResponse.json({
        rfqId: rfqDoc.id,
        extractedFields,
        message: "RFQ processed successfully"
      });

    } catch (processingError) {
      console.error("Error during processing:", processingError);
      
      // Update status to failed
      await db.update(rfqDocuments)
        .set({
          status: "failed",
          processingError: processingError instanceof Error ? processingError.message : String(processingError),
          updatedAt: new Date(),
        })
        .where(eq(rfqDocuments.id, rfqDoc.id));

      throw processingError;
    }

  } catch (error) {
    console.error("Error processing RFQ:", error);
    return NextResponse.json(
      { error: "Failed to process RFQ" },
      { status: 500 }
    );
  }
}
