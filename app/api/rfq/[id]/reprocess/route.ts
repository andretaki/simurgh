import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { downloadFromS3, getPresignedDownloadUrl } from "@/lib/aws/s3";
import pdfParse from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import { RFQ_EXTRACTION_PROMPT } from "@/lib/rfq-extraction-prompt";

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

    // Use shared extraction prompt
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                RFQ_EXTRACTION_PROMPT +
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
      console.log(
        "Reprocess Gemini response (first 1500 chars):",
        content.substring(0, 1500)
      );

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

      extractedFields = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      extractedFields = {
        error: "Failed to parse fields",
        rawResponse: completion.text()?.substring(0, 500),
      };
    }

    // Get fresh presigned URL
    const s3Url = await getPresignedDownloadUrl(rfqDoc.s3Key);

    // Extract rfqNumber from the structured response
    const rfqSummary = (extractedFields as Record<string, unknown>)
      .rfqSummary as Record<string, unknown> | undefined;
    const header = rfqSummary?.header as Record<string, unknown> | undefined;
    const buyer = rfqSummary?.buyer as Record<string, unknown> | undefined;
    const rfqNumber =
      (header?.rfqNumber as string) || rfqDoc.rfqNumber || null;
    const contractingOffice =
      (buyer?.contractingOffice as string) || rfqDoc.contractingOffice || null;

    // Update database with new extracted data
    await db
      .update(rfqDocuments)
      .set({
        extractedText: extractedText.substring(0, 10000),
        extractedFields,
        s3Url,
        rfqNumber,
        contractingOffice,
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
