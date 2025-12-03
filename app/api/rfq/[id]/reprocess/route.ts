import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { downloadFromS3, getPresignedDownloadUrl } from "@/lib/aws/s3";
import pdfParse from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rfqId = parseInt(id);

    if (isNaN(rfqId)) {
      return NextResponse.json({ error: "Invalid RFQ ID" }, { status: 400 });
    }

    // Get existing RFQ
    const rfq = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, rfqId));

    if (!rfq.length) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }

    const rfqDoc = rfq[0];

    if (!rfqDoc.s3Key) {
      return NextResponse.json({ error: "No S3 key found" }, { status: 400 });
    }

    // Download PDF from S3
    const pdfBuffer = await downloadFromS3(rfqDoc.s3Key);

    // Extract text from PDF
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    // Enhanced extraction prompt
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
- unit: Unit of measure (e.g., "Drum", "EA", "LB", "Gallon")
- description: FULL product description including ALL supplemental instructions, packaging requirements, marking requirements, etc. Include EVERYTHING.
- nsn: National Stock Number if present (e.g., "6810-00-281-2686")
- partNumber: Part number or specification (e.g., "A-A-59123", "TT-N-97")
- manufacturerPartNumber: Manufacturer's P/N if specified (e.g., "TT-N-97E Type II, 1GL Size")
- unitOfIssue: How the item is packaged (e.g., "1 DR = 100 LB Net Wt")
- specifications: Any MIL-SPEC or technical specifications
- hazmat: Boolean - is this a hazardous material?
- unNumber: UN Number for hazmat (e.g., "UN3288")

**IMPORTANT FOR DESCRIPTION:** Include the COMPLETE description with ALL:
- Product name
- Type/Grade
- Supplemental instructions
- Packaging requirements (e.g., "NEW AND UNUSED CERTIFIED METAL CAN WITH SECONDARY SEAL")
- Container requirements (e.g., "PACK EACH IN U.N. CERTIFIED 4G BOX")
- Marking/labeling requirements (e.g., "MARK AND LABEL UNIT CAN AND BOX IAW U.N. AND MIL-STD 129 REQUIREMENTS")
- Any vendor P/N requirements

Return ONLY valid JSON, no markdown formatting or code blocks.`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                systemPrompt +
                "\n\nHere is the RFQ document text to extract from:\n\n" +
                extractedText.substring(0, 30000),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8000,
      },
    });

    const completion = result.response;

    let extractedFields: Record<string, unknown> = {};
    try {
      let content = completion.text() || "{}";
      console.log("Raw Gemini response (first 2000 chars):", content.substring(0, 2000));

      // Clean up markdown code blocks
      content = content
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();

      // Try to find JSON object in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      console.log("Cleaned JSON (first 1000 chars):", content.substring(0, 1000));
      extractedFields = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      // Return raw text for debugging
      extractedFields = {
        error: "Failed to parse fields",
        rawResponse: completion.text()?.substring(0, 500)
      };
    }

    // Get fresh presigned URL
    const s3Url = await getPresignedDownloadUrl(rfqDoc.s3Key);

    // Update database with new extracted data
    await db
      .update(rfqDocuments)
      .set({
        extractedText: extractedText.substring(0, 10000),
        extractedFields,
        s3Url,
        rfqNumber:
          (extractedFields.rfqNumber as string) || rfqDoc.rfqNumber || null,
        status: "processed",
        updatedAt: new Date(),
      })
      .where(eq(rfqDocuments.id, rfqId));

    return NextResponse.json({
      success: true,
      rfqId,
      extractedFields,
      message: "RFQ reprocessed successfully",
    });
  } catch (error) {
    console.error("Error reprocessing RFQ:", error);
    return NextResponse.json(
      { error: "Failed to reprocess RFQ" },
      { status: 500 }
    );
  }
}
