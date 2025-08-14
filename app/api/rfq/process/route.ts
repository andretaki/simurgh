import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import * as pdfjs from "pdfjs-dist";
import pdfParse from "pdf-parse";
import { db } from "@/db";
import { rfqSummaries } from "@/db/schema";
import { eq } from "drizzle-orm";

// --- Configuration ---
const s3Client = new S3Client({ region: process.env.AWS_REGION! });
const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;

// Configure PDF.js worker - make sure we're not loading any test files during build
const pdfJsVersion = "4.0.269";
if (typeof window === "undefined") {
  // Server-side initialization
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsVersion}/pdf.worker.min.js`;
} else {
  // Client-side initialization
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsVersion}/pdf.worker.min.js`;
}

// --- Helper Functions ---

// Helper to get readable stream from S3
async function getS3ObjectStream(key: string): Promise<Readable> {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  const { Body } = await s3Client.send(command);
  if (!Body || !(Body instanceof Readable)) {
    throw new Error(
      "Could not retrieve PDF body from S3 or it is not a Readable stream.",
    );
  }
  return Body;
}

// Helper to convert stream to buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// --- PDF Text Extraction ---
async function extractTextFromPDFBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error("pdf-parse error:", error);
    throw new Error(
      `Failed to process PDF with pdf-parse: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// --- OpenAI Summarization with Field Extraction ---
async function processWithOpenAI(text: string): Promise<{ summary: string; extractedFields?: any }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/summarizer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, extractFields: true }),
    },
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Failed to process document with OpenAI API" }));
    throw new Error(errorData.error || "Failed to process document");
  }
  const data = await response.json();
  return {
    summary: data.summary as string,
    extractedFields: data.extractedFields
  };
}

// --- Database Interaction ---
async function saveSummaryToDb(
  filename: string,
  s3Key: string,
  summary: string,
) {
  const s3Url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
  const rfqNumberMatch = summary.match(/RFQ Number:\s*(\S+)/i);
  const vendorMatch = summary.match(/Company Name:\s*([^\n]+)/i);
  const dateMatch = summary.match(/RFQ Date:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const requestDate = dateMatch ? new Date(dateMatch[1]).toISOString() : null;

  try {
    const insertResult = await db
      .insert(rfqSummaries)
      .values({
        filename,
        s3Url,
        summary,
        rfqNumber: rfqNumberMatch ? rfqNumberMatch[1] : null,
        vendor: vendorMatch ? vendorMatch[1].trim() : null,
        requestDate,
        s3Key,
      })
      .returning();

    if (!insertResult || insertResult.length === 0) {
      throw new Error("Failed to insert summary into database.");
    }
    return insertResult[0];
  } catch (dbError) {
    console.error("Database insert error:", dbError);
    if (
      dbError instanceof Error &&
      "code" in dbError &&
      dbError.code === "23505"
    ) {
      const existing = await db.query.rfqSummaries.findFirst({
        where: eq(rfqSummaries.s3Key, s3Key),
      });
      if (existing) {
        console.warn(
          `Summary for s3Key ${s3Key} already exists (ID: ${existing.id}). Returning existing.`,
        );
        return existing;
      }
    }
    throw new Error(
      `Database error saving summary: ${dbError instanceof Error ? dbError.message : "Unknown DB error"}`,
    );
  }
}

// --- API Handler ---
export async function POST(request: NextRequest) {
  console.log("API Route /api/rfq/process called");
  try {
    const body = await request.json();
    const { s3Key, filename } = body;

    if (!s3Key || !filename) {
      console.error("Missing s3Key or filename in request body");
      return NextResponse.json(
        { error: "Missing s3Key or filename" },
        { status: 400 },
      );
    }
    console.log(`Processing s3Key: ${s3Key}, filename: ${filename}`);

    // 1. Get PDF from S3
    console.log("Fetching PDF from S3...");
    const pdfStream = await getS3ObjectStream(s3Key);
    const pdfBuffer = await streamToBuffer(pdfStream);
    console.log(`Fetched PDF buffer, size: ${pdfBuffer.length} bytes`);

    // 2. Extract Text
    console.log("Extracting text from PDF...");
    const text = await extractTextFromPDFBuffer(pdfBuffer);
    console.log(`Extracted text length: ${text.length}`);
    if (!text || text.trim().length === 0) {
      console.warn("Extracted text is empty for key:", s3Key);
      throw new Error("Extracted text content is empty.");
    }

    // 3. Summarize with OpenAI and extract fields
    console.log("Summarizing text with OpenAI and extracting form fields...");
    const { summary, extractedFields } = await processWithOpenAI(text);
    console.log("Received summary and extracted fields from OpenAI");
    
    // Log extracted fields for debugging
    if (extractedFields) {
      console.log("Extracted form fields:", extractedFields);
    }

    // 4. Save Summary to DB
    console.log("Saving summary to database...");
    const savedSummary = await saveSummaryToDb(filename, s3Key, summary);
    console.log("Summary saved to database with ID:", savedSummary.id);

    // 5. Save extracted fields to separate table if they exist
    if (extractedFields && savedSummary.id) {
      try {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS rfq_extracted_fields (
            id SERIAL PRIMARY KEY,
            rfq_id INTEGER NOT NULL REFERENCES rfq_summaries(id) ON DELETE CASCADE,
            has_unit_cost BOOLEAN DEFAULT false,
            has_delivery_time BOOLEAN DEFAULT false,
            has_payment_terms BOOLEAN DEFAULT false,
            has_fob BOOLEAN DEFAULT false,
            has_cage_code BOOLEAN DEFAULT false,
            has_sam_uei BOOLEAN DEFAULT false,
            has_naics_code BOOLEAN DEFAULT false,
            has_business_type BOOLEAN DEFAULT false,
            has_classifications BOOLEAN DEFAULT false,
            has_minimum_order BOOLEAN DEFAULT false,
            has_complimentary_freight BOOLEAN DEFAULT false,
            has_ppa_by_vendor BOOLEAN DEFAULT false,
            extracted_fields_json JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        await db.execute(`
          INSERT INTO rfq_extracted_fields (
            rfq_id, has_unit_cost, has_delivery_time, has_payment_terms,
            has_fob, has_cage_code, has_sam_uei, has_naics_code,
            has_business_type, has_classifications, has_minimum_order,
            has_complimentary_freight, has_ppa_by_vendor, extracted_fields_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          savedSummary.id,
          extractedFields.hasUnitCost || false,
          extractedFields.hasDeliveryTime || false,
          extractedFields.hasPaymentTerms || false,
          extractedFields.hasFOB || false,
          extractedFields.hasCageCode || false,
          extractedFields.hasSamUei || false,
          extractedFields.hasNaicsCode || false,
          extractedFields.hasBusinessType || false,
          extractedFields.hasClassifications || false,
          extractedFields.hasMinimumOrder || false,
          extractedFields.hasComplimentaryFreight || false,
          extractedFields.hasPpaByVendor || false,
          JSON.stringify(extractedFields)
        ]);
        console.log("Saved extracted fields for RFQ ID:", savedSummary.id);
      } catch (fieldError) {
        console.error("Error saving extracted fields:", fieldError);
        // Don't fail the whole request if field storage fails
      }
    }

    return NextResponse.json(
      {
        message: "Processing complete",
        summary: savedSummary,
        extractedFields: extractedFields || {},
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error processing RFQ:", error);
    return NextResponse.json(
      { error: `Failed to process RFQ: ${error.message}` },
      { status: 500 },
    );
  }
}
