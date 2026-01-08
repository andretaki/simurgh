import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { downloadFromS3 } from "@/lib/aws/s3";
import pdfParse from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import { BID_EXTRACTION_PROMPT, ExtractedBidData, BidSummary } from "@/lib/bid-extraction-prompt";

// Initialize Gemini with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * POST /api/rfq/[id]/extract-bid
 *
 * Extract bid/quote data from a completed RFQ response PDF.
 * Can extract from:
 * 1. The submitted PDF already stored in rfqResponses (default)
 * 2. A newly uploaded PDF (if s3Key provided in body)
 *
 * Returns the extracted bid data and optionally saves it to the response record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("=== /api/rfq/[id]/extract-bid called ===");

  try {
    const rfqId = parseInt(params.id);
    if (isNaN(rfqId)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { s3Key: providedS3Key, saveToResponse = true } = body;

    // Get the RFQ document
    const rfqDocs = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, rfqId))
      .limit(1);

    if (rfqDocs.length === 0) {
      return NextResponse.json(
        { error: "RFQ not found" },
        { status: 404 }
      );
    }

    // Get the existing response (if any) to find the submitted PDF
    const existingResponses = await db
      .select()
      .from(rfqResponses)
      .where(eq(rfqResponses.rfqDocumentId, rfqId))
      .limit(1);

    // Determine which PDF to extract from
    let s3KeyToExtract: string | null = providedS3Key || null;

    if (!s3KeyToExtract && existingResponses.length > 0) {
      s3KeyToExtract = existingResponses[0].generatedPdfS3Key;
    }

    if (!s3KeyToExtract) {
      return NextResponse.json(
        { error: "No completed PDF found. Please upload a completed PDF first or provide s3Key." },
        { status: 400 }
      );
    }

    console.log(`Extracting bid data from S3 key: ${s3KeyToExtract}`);

    // Download and parse the PDF
    const pdfBuffer = await downloadFromS3(s3KeyToExtract);
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    console.log(`Extracted ${extractedText.length} characters from PDF`);

    // Use Gemini to extract bid data
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                BID_EXTRACTION_PROMPT +
                "\n\nHere is the completed RFQ response document text to extract bid data from:\n\n" +
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
    let extractedBid: ExtractedBidData | null = null;

    try {
      let content = completion.text() || "{}";
      console.log(
        "Gemini bid extraction result (first 1000 chars):",
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

      extractedBid = JSON.parse(content) as ExtractedBidData;
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return NextResponse.json(
        { error: "Failed to parse extracted bid data" },
        { status: 500 }
      );
    }

    // Convert extracted bid to ResponseData format for storage
    const bidSummary = extractedBid.bidSummary;
    const responseDataFromBid = convertBidToResponseData(bidSummary);

    // Optionally save the extracted data to the response record
    if (saveToResponse && existingResponses.length > 0) {
      // Merge with existing response data (don't overwrite everything)
      const existingData = existingResponses[0].responseData as Record<string, unknown> || {};
      const mergedData = {
        ...existingData,
        ...responseDataFromBid,
        extractedFromPdf: true,
        extractedAt: new Date().toISOString(),
      };

      await db
        .update(rfqResponses)
        .set({
          responseData: mergedData,
          updatedAt: new Date(),
        })
        .where(eq(rfqResponses.id, existingResponses[0].id));

      console.log("Saved extracted bid data to response record");
    }

    return NextResponse.json({
      success: true,
      rfqId,
      bidSummary: extractedBid.bidSummary,
      responseData: responseDataFromBid,
      savedToResponse: saveToResponse && existingResponses.length > 0,
      message: "Bid data extracted successfully",
    });

  } catch (error) {
    console.error("Error extracting bid data:", error);
    return NextResponse.json(
      { error: "Failed to extract bid data", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Convert extracted BidSummary to ResponseData format
 * This allows the extracted data to be used in the existing quote workflow
 */
function convertBidToResponseData(bid: BidSummary): Record<string, unknown> {
  return {
    pricesFirmUntil: bid.pricesFirmUntil,
    quoteRefNum: bid.quoteReferenceNumber,
    paymentTerms: mapPaymentTerms(bid.terms.paymentTerms),
    paymentTermsOther: bid.terms.paymentTerms,
    fob: mapFob(bid.terms.fob),
    purchaseOrderMinimum: bid.terms.minimumOrder,
    cageCode: bid.vendor.cageCode,
    samUei: bid.vendor.samUei,
    smallDisadvantaged: bid.certifications.smallDisadvantaged,
    womanOwned: bid.certifications.womanOwned,
    veteranOwned: bid.certifications.veteranOwned,
    serviceDisabledVetOwned: bid.certifications.serviceDisabledVeteran,
    hubZone: bid.certifications.hubZone,
    businessType: bid.certifications.smallBusiness ? "small" : "large",
    lineItems: bid.lineItems.map((item) => ({
      itemNumber: item.itemNumber,
      unitCost: item.unitPrice?.toString() || "",
      deliveryDays: item.deliveryDays?.toString() || "",
      countryOfOrigin: item.countryOfOrigin || "USA",
      manufacturer: item.manufacturer || "",
      isIawNsn: true,
      minimumQty: "",
      qtyUnitPack: "",
      exceptionNote: "",
      noBidReason: item.noBid ? "other" : "",
      noBidOtherText: item.noBidReason || "",
      priceBreaks: item.priceBreaks.map((pb) => ({
        fromQty: pb.minQuantity,
        toQty: pb.maxQuantity || 999999,
        unitCost: pb.unitPrice.toString(),
        deliveryDays: item.deliveryDays?.toString() || "",
      })),
    })),
    // Store original extracted data for reference
    _extractedBid: {
      rfqNumber: bid.rfqNumber,
      quoteDate: bid.quoteDate,
      vendor: bid.vendor,
      totalQuoteAmount: bid.totalQuoteAmount,
      notes: bid.notes,
    },
  };
}

function mapPaymentTerms(terms: string | null): string {
  if (!terms) return "";
  const lower = terms.toLowerCase();
  if (lower.includes("net 30")) return "net30";
  if (lower.includes("net 45")) return "net45";
  if (lower.includes("net 60")) return "net60";
  if (lower.includes("2%") || lower.includes("2/10")) return "2_10_net30";
  return "other";
}

function mapFob(fob: string | null): "origin" | "destination" | undefined {
  if (!fob) return undefined;
  const lower = fob.toLowerCase();
  if (lower.includes("origin")) return "origin";
  if (lower.includes("destination")) return "destination";
  return undefined;
}
