import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { downloadFromS3, getPresignedDownloadUrl } from "@/lib/aws/s3";
import pdfParse from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import { RFQ_EXTRACTION_PROMPT } from "@/lib/rfq-extraction-prompt";

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
    const [rfqDoc] = await db
      .insert(rfqDocuments)
      .values({
        fileName,
        s3Key,
        fileSize,
        mimeType,
        status: "processing",
      })
      .returning();

    try {
      // Download PDF from S3
      const pdfBuffer = await downloadFromS3(s3Key);

      // Extract text from PDF
      const pdfData = await pdfParse(pdfBuffer);
      const extractedText = pdfData.text;

      // Use Gemini to extract structured RFQ data
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
          "Gemini extraction result (first 1000 chars):",
          content.substring(0, 1000)
        );

        // Clean up markdown code blocks if present
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
        extractedFields = { error: "Failed to parse fields" };
      }

      // Get presigned URL for accessing the PDF
      const s3Url = await getPresignedDownloadUrl(s3Key);

      // Extract rfqNumber from the structured response
      const rfqSummary = (extractedFields as Record<string, unknown>)
        .rfqSummary as Record<string, unknown> | undefined;
      const header = rfqSummary?.header as Record<string, unknown> | undefined;
      const buyer = rfqSummary?.buyer as Record<string, unknown> | undefined;
      const rfqNumber = (header?.rfqNumber as string) || null;
      const contractingOffice = (buyer?.contractingOffice as string) || null;

      // Update database with extracted data
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
        .where(eq(rfqDocuments.id, rfqDoc.id));

      return NextResponse.json({
        rfqId: rfqDoc.id,
        extractedFields,
        message: "RFQ processed successfully",
      });
    } catch (processingError) {
      console.error("Error during processing:", processingError);

      // Update status to failed
      await db
        .update(rfqDocuments)
        .set({
          status: "failed",
          processingError:
            processingError instanceof Error
              ? processingError.message
              : String(processingError),
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
