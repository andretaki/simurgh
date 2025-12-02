import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { downloadFromS3, getPresignedDownloadUrl } from "@/lib/aws/s3";
import pdfParse from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";

// Initialize Gemini with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });





export async function POST(request: NextRequest) {
  console.log("=== /api/rfq/process called ===");
  try {
    const body = await request.json();
    console.log("RFQ process request body:", body);
    const { s3Key, fileName, fileSize, mimeType } = body;

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

      // Use Gemini 2.5 Flash to identify fields - enhanced for ASRC Federal and government RFQ formats
      const systemPrompt = `You are an expert at extracting information from government RFQ (Request for Quote) documents, particularly ASRC Federal and DLA formats.

Extract ALL of the following fields and return as JSON:

**RFQ HEADER INFO:**
- rfqNumber: The RFQ number (e.g., "821 - 36208263")
- rfqDate: Date the RFQ was issued (ISO format)
- quoteFirmUntil: Date prices must be firm until (ISO format)
- requestedReplyDate: When they need your response by (ISO format)
- deliveryBeforeDate: Required delivery date (ISO format)

**BUYER/CONTRACTING INFO:**
- contractingOffice: The contracting agency (e.g., "ASRC Federal Facilities Logistics")
- primeContractNumber: Any prime contract number referenced
- pocName: Point of contact name
- pocEmail: Point of contact email
- pocPhone: Point of contact phone
- pocFax: Point of contact fax

**LINE ITEMS (array called "items"):**
For each item, extract:
- itemNumber: Line item number (e.g., "1", "Item 1")
- quantity: Numeric quantity requested
- unit: Unit of measure (e.g., "Drum", "EA", "LB")
- description: Full product description
- nsn: National Stock Number if present (e.g., "6810-00-281-2686")
- partNumber: Part number or specification (e.g., "A-A-59123")
- manufacturerPartNumber: Manufacturer's P/N if specified
- unitOfIssue: How the item is packaged (e.g., "1 DR = 100 LB Net Wt")
- specifications: Any MIL-SPEC or technical specifications
- hazmat: Boolean - is this a hazardous material?
- unNumber: UN Number for hazmat (e.g., "UN3288")

**FORM FIELD REQUIREMENTS (what the RFQ asks you to fill):**
- requiresCageCode: boolean
- requiresSamUei: boolean
- requiresNaicsCode: boolean
- requiresBusinessType: boolean
- requiresCertifications: boolean
- requiresPaymentTerms: boolean
- requiresFobTerms: boolean
- requiresShippingCost: boolean
- requiresCountryOfOrigin: boolean
- requiresDeliveryDays: boolean
- requiresUnitCost: boolean
- requiresPriceBreaks: boolean
- requiresManufacturer: boolean
- requiresMinimumQty: boolean

**SPECIAL CLAUSES (array of clause codes):**
- clauseCodes: Array of clause codes mentioned (e.g., ["P724", "P710", "C903"])

**DEFAULT TERMS SHOWN:**
- defaultPaymentTerms: What payment terms they show as default (e.g., "Net 45")
- defaultFob: Default FOB terms shown

Return ONLY valid JSON, no markdown formatting or code blocks.`;

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt + "\n\nHere is the RFQ document text to extract from:\n\n" + extractedText.substring(0, 30000) }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000,
        },
      });

      const completion = result.response;

      let extractedFields: any = {};
      try {
        // Get text from Gemini response
        let content = completion.text() || "{}";

        // Clean up markdown code blocks if present
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        console.log("Gemini extraction result (first 500 chars):", content.substring(0, 500));
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
