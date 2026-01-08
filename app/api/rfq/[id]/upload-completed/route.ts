import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqResponses, companyProfiles } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { downloadFromS3 } from "@/lib/aws/s3";
import pdfParse from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BID_EXTRACTION_PROMPT, ExtractedBidData, BidSummary } from "@/lib/bid-extraction-prompt";

// Initialize Gemini for bid extraction
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rfqId = parseInt(params.id);
    const { pdfUrl, s3Key, responseData, extractBid = false } = await request.json();

    if (isNaN(rfqId)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID" },
        { status: 400 }
      );
    }

    if (!pdfUrl || !s3Key) {
      return NextResponse.json(
        { error: "Missing pdfUrl or s3Key" },
        { status: 400 }
      );
    }

    // Get company profile if exists
    const profiles = await db.select().from(companyProfiles).limit(1);
    const profile = profiles[0] || null;

    // Check if a response already exists for this RFQ
    const existingResponses = await db
      .select()
      .from(rfqResponses)
      .where(eq(rfqResponses.rfqDocumentId, rfqId))
      .limit(1);

    // If extractBid is true, extract bid data from the uploaded PDF
    let extractedResponseData = responseData || {};
    let extractedBidSummary: BidSummary | null = null;

    if (extractBid) {
      try {
        console.log(`Extracting bid data from uploaded PDF: ${s3Key}`);
        const bidData = await extractBidFromPdf(s3Key);
        if (bidData) {
          extractedBidSummary = bidData.bidSummary;
          extractedResponseData = {
            ...extractedResponseData,
            ...convertBidToResponseData(bidData.bidSummary),
            extractedFromPdf: true,
            extractedAt: new Date().toISOString(),
          };
          console.log("Successfully extracted bid data from PDF");
        }
      } catch (extractError) {
        console.error("Failed to extract bid data (continuing with upload):", extractError);
        // Continue with upload even if extraction fails
      }
    }

    let savedResponse;

    if (existingResponses.length > 0) {
      // Update existing response with the manually filled PDF
      [savedResponse] = await db
        .update(rfqResponses)
        .set({
          responseData: extractedResponseData || existingResponses[0].responseData,
          companyProfileId: profile?.id || null,
          status: "submitted",
          generatedPdfUrl: pdfUrl,
          generatedPdfS3Key: s3Key,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rfqResponses.id, existingResponses[0].id))
        .returning();
    } else {
      // Create new response with the manually filled PDF
      [savedResponse] = await db
        .insert(rfqResponses)
        .values({
          rfqDocumentId: rfqId,
          companyProfileId: profile?.id || null,
          responseData: extractedResponseData,
          status: "submitted",
          generatedPdfUrl: pdfUrl,
          generatedPdfS3Key: s3Key,
          submittedAt: new Date(),
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      responseId: savedResponse.id,
      pdfUrl,
      bidExtracted: extractBid && extractedBidSummary !== null,
      bidSummary: extractedBidSummary,
      message: extractBid && extractedBidSummary
        ? "Completed PDF uploaded and bid data extracted successfully"
        : "Completed PDF uploaded successfully",
    });

  } catch (error) {
    console.error("Error uploading completed PDF:", error);
    return NextResponse.json(
      { error: "Failed to save completed PDF" },
      { status: 500 }
    );
  }
}

/**
 * Extract bid data from a PDF using Gemini AI
 */
async function extractBidFromPdf(s3Key: string): Promise<ExtractedBidData | null> {
  const pdfBuffer = await downloadFromS3(s3Key);
  const pdfData = await pdfParse(pdfBuffer);
  const extractedText = pdfData.text;

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

  let content = result.response.text() || "{}";
  content = content
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    content = jsonMatch[0];
  }

  return JSON.parse(content) as ExtractedBidData;
}

/**
 * Convert extracted BidSummary to ResponseData format
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
