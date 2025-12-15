import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, companyProfiles } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { buildRfqResponse } from "@/lib/rfq-response-builder";
import { RfqSummary, ExtractedRfqData } from "@/lib/rfq-extraction-prompt";
import { CompanyProfile } from "@/lib/types/index";

/**
 * GET /api/rfq/:id/build-response
 *
 * Returns the three sections needed for RFQ-to-Quote workflow:
 * - parsedJson: Raw extracted RFQ data
 * - templatePayload: Pre-filled ResponseData with company boilerplate (pricing empty)
 * - previewForBoss: Human-readable summary for review
 */
export async function GET(
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

    // Fetch the RFQ document with extracted fields
    const [rfqDoc] = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, rfqId))
      .limit(1);

    if (!rfqDoc) {
      return NextResponse.json(
        { error: "RFQ document not found" },
        { status: 404 }
      );
    }

    // Check if RFQ has been processed and has extracted fields
    if (rfqDoc.status !== "processed" || !rfqDoc.extractedFields) {
      return NextResponse.json(
        {
          error: "RFQ has not been processed yet or extraction failed",
          status: rfqDoc.status,
          hasExtractedFields: !!rfqDoc.extractedFields
        },
        { status: 400 }
      );
    }

    // Parse the extracted fields - could be ExtractedRfqData or RfqSummary directly
    let rfqSummary: RfqSummary;
    const extractedFields = rfqDoc.extractedFields as unknown;

    if (extractedFields && typeof extractedFields === "object") {
      // Check if it's wrapped in { rfqSummary: ... } or is the RfqSummary directly
      if ("rfqSummary" in (extractedFields as object)) {
        rfqSummary = (extractedFields as ExtractedRfqData).rfqSummary;
      } else if ("header" in (extractedFields as object)) {
        // It's the RfqSummary directly
        rfqSummary = extractedFields as RfqSummary;
      } else {
        return NextResponse.json(
          { error: "Invalid extracted fields format - missing rfqSummary" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid extracted fields format" },
        { status: 400 }
      );
    }

    // Fetch company profile
    const [profile] = await db
      .select()
      .from(companyProfiles)
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { error: "Company profile not found. Please configure your company profile first." },
        { status: 404 }
      );
    }

    // Convert DB profile to CompanyProfile type
    const companyProfile: CompanyProfile = {
      id: profile.id,
      companyName: profile.companyName,
      cageCode: profile.cageCode,
      samUei: profile.samUei,
      samRegistered: profile.samRegistered ?? false,
      naicsCode: profile.naicsCode,
      naicsSize: profile.naicsSize,
      employeeCount: profile.employeeCount,
      businessType: profile.businessType,
      smallDisadvantaged: profile.smallDisadvantaged ?? false,
      womanOwned: profile.womanOwned ?? false,
      veteranOwned: profile.veteranOwned ?? false,
      serviceDisabledVetOwned: profile.serviceDisabledVetOwned ?? false,
      hubZone: profile.hubZone ?? false,
      historicallyUnderutilized: profile.historicallyUnderutilized ?? false,
      alaskaNativeCorp: profile.alaskaNativeCorp ?? false,
      defaultPaymentTerms: profile.defaultPaymentTerms,
      defaultPaymentTermsOther: profile.defaultPaymentTermsOther,
      defaultFob: profile.defaultFob,
      defaultPurchaseOrderMin: profile.defaultPurchaseOrderMin?.toString() ?? null,
      noFreightAdder: profile.noFreightAdder ?? true,
      defaultPpaByVendor: profile.defaultPpaByVendor ?? false,
      countryOfOrigin: profile.countryOfOrigin,
      contactPerson: profile.contactPerson,
      contactEmail: profile.contactEmail,
      contactPhone: profile.contactPhone,
      address: profile.address,
    };

    // Build the three response sections
    const result = buildRfqResponse(rfqSummary, companyProfile);

    return NextResponse.json({
      success: true,
      rfqId,
      rfqNumber: rfqDoc.rfqNumber,
      ...result,
    });
  } catch (error) {
    console.error("Error building RFQ response:", error);
    return NextResponse.json(
      {
        error: "Failed to build RFQ response",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
