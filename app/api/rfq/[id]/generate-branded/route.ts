/**
 * POST /api/rfq/[id]/generate-branded
 *
 * Generates a branded Alliance Chemical vendor quote PDF.
 * Returns the PDF as a downloadable attachment.
 *
 * Request body:
 * {
 *   responseData: ResponseData,  // Same structure as existing generate endpoint
 *   vendorQuoteRef?: string,     // Optional, auto-generated if missing
 *   quoteValidUntil?: string,    // Optional, defaults to 30 days from now
 *   notes?: string               // Optional notes/exceptions
 * }
 *
 * Response: application/pdf with Content-Disposition attachment
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses, companyProfiles } from "@/drizzle/migrations/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { uploadToS3 } from "@/lib/aws/s3";
import {
  generateVendorQuotePDF,
  generateVendorQuoteRef,
  VendorQuoteData,
  VendorQuoteLineItem,
} from "@/lib/vendor-quote-generator";
import type { RfqSummary } from "@/lib/rfq-extraction-prompt";

interface ResponseData {
  pricesFirmUntil?: string;
  quoteRefNum?: string;
  paymentTerms?: string;
  paymentTermsOther?: string;
  shippingCost?: "noFreight" | "ppa";
  fob?: "origin" | "destination";
  purchaseOrderMinimum?: string;
  samUei?: string;
  cageCode?: string;
  samRegistered?: boolean;
  naicsCode?: string;
  naicsSizeStandard?: string;
  businessType?: "large" | "small";
  smallDisadvantaged?: boolean;
  womanOwned?: boolean;
  veteranOwned?: boolean;
  serviceDisabledVetOwned?: boolean;
  hubZone?: boolean;
  hbcu?: boolean;
  alaskaNative?: boolean;
  otherSmallBusiness?: boolean;
  employeeCount?: string;
  lineItems?: Array<{
    itemNumber: string;
    unitCost: string;
    deliveryDays: string;
    countryOfOrigin: string;
    manufacturer: string;
    isIawNsn: boolean;
    minimumQty: string;
    qtyUnitPack: string;
    exceptionNote: string;
    noBidReason?: "" | "not_our_product" | "distributor_only" | "obsolete" | "out_of_stock" | "other";
    noBidOtherText?: string;
    priceBreaks: Array<{
      fromQty: number;
      toQty: number;
      unitCost: string;
      deliveryDays: string;
    }>;
  }>;
  authorizedSignature?: string;
  signatureDate?: string;
  noBidReason?: "" | "not_accepting" | "geographic" | "debarred" | "other";
  noBidOtherText?: string;
}

interface RequestBody {
  responseData: ResponseData;
  vendorQuoteRef?: string;
  quoteValidUntil?: string;
  notes?: string;
}

/**
 * Validate that required fields are present for quote generation
 */
function validateQuoteData(responseData: ResponseData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!responseData.lineItems || responseData.lineItems.length === 0) {
    errors.push("No line items present");
    return { valid: false, errors };
  }

  // Check each line item has pricing (or is no-bid)
  responseData.lineItems.forEach((item, idx) => {
    if (!item.noBidReason && (!item.unitCost || item.unitCost.trim() === "")) {
      errors.push(`Line item ${item.itemNumber || idx + 1}: Unit price is required`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Parse a price string to a number
 * Handles formats like "159.85", "$159.85", "1,234.56"
 */
function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  // Remove currency symbols, commas, and whitespace
  const cleaned = priceStr.replace(/[$,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rfqId = parseInt(params.id);

    if (isNaN(rfqId)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID" },
        { status: 400 }
      );
    }

    const body: RequestBody = await request.json();
    const { responseData, notes } = body;
    let { vendorQuoteRef, quoteValidUntil } = body;

    // Validate response data
    const validation = validateQuoteData(responseData);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    // Get RFQ document
    const [rfqDoc] = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, rfqId))
      .limit(1);

    if (!rfqDoc) {
      return NextResponse.json(
        { error: "RFQ not found" },
        { status: 404 }
      );
    }

    // Get company profile
    const profiles = await db.select().from(companyProfiles).limit(1);
    const profile = profiles[0] || null;

    if (!profile) {
      return NextResponse.json(
        { error: "Company profile not configured" },
        { status: 400 }
      );
    }

    // Get RFQ extracted data
    const extractedFields = rfqDoc.extractedFields as { rfqSummary?: RfqSummary } | null;
    const rfqSummary = extractedFields?.rfqSummary;
    const rfqNumber = rfqSummary?.header?.rfqNumber || rfqDoc.rfqNumber || `RFQ-${rfqId}`;

    // Generate vendorQuoteRef if not provided
    if (!vendorQuoteRef) {
      // Count existing responses for this RFQ to determine sequence
      const existingResponses = await db
        .select()
        .from(rfqResponses)
        .where(
          and(
            eq(rfqResponses.rfqDocumentId, rfqId),
            isNotNull(rfqResponses.vendorQuoteRef)
          )
        );

      vendorQuoteRef = generateVendorQuoteRef(rfqNumber, existingResponses.length);

      // Handle potential collision by incrementing seq
      let attempts = 0;
      while (attempts < 5) {
        const [existing] = await db
          .select()
          .from(rfqResponses)
          .where(eq(rfqResponses.vendorQuoteRef, vendorQuoteRef))
          .limit(1);

        if (!existing) break;

        // Collision - increment sequence
        vendorQuoteRef = generateVendorQuoteRef(rfqNumber, existingResponses.length + attempts + 1);
        attempts++;
      }
    }

    // Set quoteValidUntil if not provided (default 30 days)
    if (!quoteValidUntil) {
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 30);
      quoteValidUntil = validDate.toISOString().split("T")[0];
    }

    // Build certifications list
    const certifications: string[] = [];
    if (responseData.samRegistered) certifications.push("SAM Registered");
    if (responseData.smallDisadvantaged) certifications.push("SDB");
    if (responseData.womanOwned) certifications.push("WOSB");
    if (responseData.veteranOwned) certifications.push("VOSB");
    if (responseData.serviceDisabledVetOwned) certifications.push("SDVOSB");
    if (responseData.hubZone) certifications.push("HUBZone");

    // Build line items for the quote
    const rfqItems = rfqSummary?.items || [];
    const quoteLineItems: VendorQuoteLineItem[] = (responseData.lineItems || [])
      .filter((item) => !item.noBidReason) // Exclude no-bid items
      .map((item, idx) => {
        const rfqItem = rfqItems.find((ri) => ri.itemNumber === item.itemNumber) || rfqItems[idx];

        return {
          lineNumber: item.itemNumber,
          nsn: rfqItem?.nsn || null,
          partNumber: rfqItem?.partNumber || null,
          description: rfqItem?.shortDescription || rfqItem?.productType || "Product",
          unitOfMeasure: rfqItem?.unitOfIssue || rfqItem?.unit || "EA",
          quantity: rfqItem?.quantity || 1,
          unitPrice: parsePrice(item.unitCost),
          deliveryDays: item.deliveryDays,
          countryOfOrigin: item.countryOfOrigin,
          isIawNsn: item.isIawNsn,
          priceBreaks: item.priceBreaks?.map((pb) => ({
            fromQty: pb.fromQty,
            toQty: pb.toQty,
            unitPrice: parsePrice(pb.unitCost),
            deliveryDays: pb.deliveryDays,
          })),
        };
      });

    // Build the quote data
    const quoteData: VendorQuoteData = {
      vendorQuoteRef,
      quoteDate: new Date().toISOString().split("T")[0],
      quoteValidUntil,
      rfqNumber,
      rfqDate: rfqSummary?.header?.rfqDate || undefined,
      buyerName: rfqSummary?.buyer?.pocName || undefined,
      buyerEmail: rfqSummary?.buyer?.pocEmail || undefined,
      buyerPhone: rfqSummary?.buyer?.pocPhone || undefined,
      contractingOffice: rfqSummary?.buyer?.contractingOffice || rfqDoc.contractingOffice || undefined,
      shipToAddress: undefined, // Could be extracted from RFQ if present
      fob: responseData.fob === "destination" ? "Destination" : "Origin",
      paymentTerms: responseData.paymentTerms === "net45" ? "Net 45" : responseData.paymentTermsOther || "Net 30",
      deliveryDays: responseData.lineItems?.[0]?.deliveryDays, // Use first item as global default
      companyName: profile.companyName,
      companyAddress: profile.address || "204 S. Edmond St., Taylor, TX 76574",
      companyPhone: profile.contactPhone || "512-365-6838",
      companyWebsite: "www.alliancechemical.com",
      cageCode: responseData.cageCode || profile.cageCode || undefined,
      samUei: responseData.samUei || profile.samUei || undefined,
      naicsCode: responseData.naicsCode || profile.naicsCode || undefined,
      certifications,
      countryOfOrigin: responseData.lineItems?.[0]?.countryOfOrigin || "USA",
      lineItems: quoteLineItems,
      notes,
      authorizedSignature: responseData.authorizedSignature || profile.contactPerson || undefined,
    };

    // Generate the PDF
    console.log(`Generating branded quote PDF for RFQ ${rfqId}, ref: ${vendorQuoteRef}`);
    const pdfBuffer = generateVendorQuotePDF(quoteData);

    // Upload to S3
    const timestamp = Date.now();
    const s3Key = `quotes/${rfqId}-${timestamp}-branded.pdf`;
    const { url: pdfUrl } = await uploadToS3(s3Key, pdfBuffer, "application/pdf");

    // Upsert response record
    const [existing] = await db
      .select()
      .from(rfqResponses)
      .where(eq(rfqResponses.rfqDocumentId, rfqId))
      .limit(1);

    if (existing) {
      await db
        .update(rfqResponses)
        .set({
          companyProfileId: profile.id,
          responseData,
          vendorQuoteRef,
          quoteValidUntil: new Date(quoteValidUntil),
          generatedBrandedQuoteS3Key: s3Key,
          generatedBrandedQuoteUrl: pdfUrl,
          quoteNotes: notes || null,
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(rfqResponses.id, existing.id));
    } else {
      await db.insert(rfqResponses).values({
        rfqDocumentId: rfqId,
        companyProfileId: profile.id,
        responseData,
        vendorQuoteRef,
        quoteValidUntil: new Date(quoteValidUntil),
        generatedBrandedQuoteS3Key: s3Key,
        generatedBrandedQuoteUrl: pdfUrl,
        quoteNotes: notes || null,
        status: "completed",
      });
    }

    console.log(`Branded quote PDF generated and saved. Ref: ${vendorQuoteRef}`);

    // Return PDF as downloadable attachment
    const filename = `AllianceChemicalQuote_${vendorQuoteRef.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const pdfUint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(pdfUint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        // Include metadata in headers for client convenience
        "X-Vendor-Quote-Ref": vendorQuoteRef,
        "X-Quote-Valid-Until": quoteValidUntil,
        "X-PDF-URL": pdfUrl,
      },
    });
  } catch (error) {
    console.error("Error generating branded quote PDF:", error);
    return NextResponse.json(
      {
        error: "Failed to generate branded quote PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
