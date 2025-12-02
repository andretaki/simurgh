import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses, companyProfiles } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { uploadToS3, downloadFromS3 } from "@/lib/aws/s3";

// Coordinate mappings for ASRC Federal RFQ form
// Based on actual PDF field positions from filled example
const PAGE_1_FIELDS = {
  // Quote Header
  pricesFirmUntil: { x: 109.66, y: 338.4, size: 10 },
  quoteRefNum: { x: 264.78, y: 338.4, size: 10 },

  // Payment Terms - "Other" text field
  paymentTermsOther: { x: 339.85, y: 322.4, size: 10 },

  // Checkboxes / Radio buttons (draw "X" at these coordinates)
  paymentTermsNet45: { x: 113.45, y: 320.9 },      // Net 45 radio
  paymentTermsOtherRadio: { x: 288.66, y: 320.9 }, // Other radio

  // Shipping
  noFreightAdder: { x: 98.17, y: 304.9 },          // Checkbox
  ppaBySupplier: { x: 194.88, y: 304.9 },          // Checkbox
  fobOrigin: { x: 66.61, y: 288.9 },               // Radio
  fobDestination: { x: 116.1, y: 288.9 },          // Radio
  purchaseOrderMinimum: { x: 150.38, y: 274.4, size: 10 },

  // Business Info
  samUei: { x: 80.42, y: 258.4, size: 10 },
  cageCode: { x: 239.2, y: 258.4, size: 10 },
  samYes: { x: 446.1, y: 256.9 },                  // Radio
  samNo: { x: 482.1, y: 256.9 },                   // Radio
  naicsCode: { x: 93.19, y: 242.4, size: 10 },
  naicsSizeStandard: { x: 535.82, y: 242.4, size: 10 },
  businessTypeLarge: { x: 102.24, y: 224.9 },      // Radio
  businessTypeSmall: { x: 142.24, y: 224.9 },      // Radio

  // Certifications (checkboxes)
  smallDisadvantaged: { x: 46, y: 198.1 },
  hubZone: { x: 287.09, y: 198.1 },
  womanOwned: { x: 46, y: 174.9 },
  veteranOwned: { x: 287.46, y: 174.9 },
  serviceDisabledVet: { x: 46, y: 151.7 },
  historicallyUnderutilized: { x: 287.5, y: 151.7 },
  alaskaNative: { x: 46, y: 128.5 },
  otherSmallBusiness: { x: 288.01, y: 128.5 },

  // Employee count radios
  employeeLt500: { x: 36, y: 94.5 },
  employee501_750: { x: 77, y: 94.5 },
  employee751_1000: { x: 132, y: 94.5 },
  employee1001_1500: { x: 192, y: 94.5 },
  employeeGt1500: { x: 260, y: 94.5 },
};

const PAGE_2_FIELDS = {
  // Signature section
  authorizedSignature: { x: 115, y: 722, size: 11 },
  signatureDate: { x: 380, y: 722, size: 11 },

  // No Bid Reason radios
  noBidNotAccepting: { x: 36, y: 736.5 },
  noBidGeographic: { x: 204.42, y: 736.5 },
  noBidDebarred: { x: 36, y: 720.5 },
  noBidOther: { x: 193.42, y: 720.5 },
  noBidOtherText: { x: 244.61, y: 722, size: 10 },
};

const PAGE_3_FIELDS = {
  // Line item pricing - these are the key manual entry fields
  unitCost: { x: 80.59, y: 554, size: 10 },
  deliveryDays: { x: 246.55, y: 552, size: 12 },
  countryOfOriginUSA: { x: 377.89, y: 552.5 },     // Radio
  countryOfOriginOther: { x: 426.31, y: 552.5 },   // Radio
  countryOfOriginOtherText: { x: 472.98, y: 554, size: 10 },
  exceptionNote: { x: 105.28, y: 538, size: 10 },

  // Polchem questions
  isIawNsn: { x: 292.11, y: 455, size: 12 },
  minimumQtyRun: { x: 171.55, y: 439, size: 12 },
  qtyUnitPack: { x: 130.98, y: 423, size: 12 },

  // Price Breaks table - Row positions (y decreases for each row)
  priceBreakTable: {
    row1: { fromQty: 36, toQty: 85, unitCost: 160, delDays: 260, y: 325 },
    row2: { fromQty: 36, toQty: 85, unitCost: 160, delDays: 260, y: 305 },
    row3: { fromQty: 36, toQty: 85, unitCost: 160, delDays: 260, y: 285 },
    row4: { fromQty: 36, toQty: 85, unitCost: 160, delDays: 260, y: 265 },
  },
};

interface ResponseData {
  pricesFirmUntil?: string;
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
    priceBreaks: Array<{
      fromQty: number;
      toQty: number;
      unitCost: string;
      deliveryDays: string;
    }>;
  }>;
  authorizedSignature?: string;
  signatureDate?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rfqId = parseInt(params.id);
    const { responseData }: { responseData: ResponseData } = await request.json();

    if (isNaN(rfqId)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID" },
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

    // Get company profile if exists
    const profiles = await db.select().from(companyProfiles).limit(1);
    const profile = profiles[0] || null;

    // Download the original RFQ PDF from S3
    let pdfDoc: PDFDocument;

    if (rfqDoc.s3Key) {
      console.log("Downloading original PDF from S3:", rfqDoc.s3Key);
      const originalPdfBytes = await downloadFromS3(rfqDoc.s3Key);
      pdfDoc = await PDFDocument.load(originalPdfBytes);
      console.log(`Original PDF loaded, has ${pdfDoc.getPageCount()} pages`);
    } else {
      // Fallback: create a new PDF if no original exists
      console.log("No original PDF found, creating new document");
      pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([612, 792]);
    }

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    // Helper to draw text on a specific page
    const drawText = (pageIndex: number, text: string, x: number, y: number, size: number = 10) => {
      if (pageIndex < pages.length && text) {
        pages[pageIndex].drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
      }
    };

    // Helper to draw "X" for checkboxes/radios
    const drawX = (pageIndex: number, x: number, y: number) => {
      if (pageIndex < pages.length) {
        pages[pageIndex].drawText("X", { x, y, size: 12, font, color: rgb(0, 0, 0) });
      }
    };

    // ========== PAGE 1: Quote Header & Business Info ==========
    if (pages.length >= 1) {
      // Price Firm Until date
      if (responseData.pricesFirmUntil) {
        const date = new Date(responseData.pricesFirmUntil);
        const formatted = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
        drawText(0, formatted, PAGE_1_FIELDS.pricesFirmUntil.x, PAGE_1_FIELDS.pricesFirmUntil.y, PAGE_1_FIELDS.pricesFirmUntil.size);
      }

      // Payment Terms
      if (responseData.paymentTerms === "net45") {
        drawX(0, PAGE_1_FIELDS.paymentTermsNet45.x, PAGE_1_FIELDS.paymentTermsNet45.y);
      } else {
        drawX(0, PAGE_1_FIELDS.paymentTermsOtherRadio.x, PAGE_1_FIELDS.paymentTermsOtherRadio.y);
        if (responseData.paymentTermsOther) {
          drawText(0, responseData.paymentTermsOther, PAGE_1_FIELDS.paymentTermsOther.x, PAGE_1_FIELDS.paymentTermsOther.y, PAGE_1_FIELDS.paymentTermsOther.size);
        }
      }

      // Shipping Cost
      if (responseData.shippingCost === "noFreight") {
        drawX(0, PAGE_1_FIELDS.noFreightAdder.x, PAGE_1_FIELDS.noFreightAdder.y);
      } else if (responseData.shippingCost === "ppa") {
        drawX(0, PAGE_1_FIELDS.ppaBySupplier.x, PAGE_1_FIELDS.ppaBySupplier.y);
      }

      // FOB
      if (responseData.fob === "origin") {
        drawX(0, PAGE_1_FIELDS.fobOrigin.x, PAGE_1_FIELDS.fobOrigin.y);
      } else if (responseData.fob === "destination") {
        drawX(0, PAGE_1_FIELDS.fobDestination.x, PAGE_1_FIELDS.fobDestination.y);
      }

      // Business Info
      if (responseData.cageCode) {
        drawText(0, responseData.cageCode, PAGE_1_FIELDS.cageCode.x, PAGE_1_FIELDS.cageCode.y, PAGE_1_FIELDS.cageCode.size);
      }
      if (responseData.samUei) {
        drawText(0, responseData.samUei, PAGE_1_FIELDS.samUei.x, PAGE_1_FIELDS.samUei.y, PAGE_1_FIELDS.samUei.size);
      }
      if (responseData.naicsCode) {
        drawText(0, responseData.naicsCode, PAGE_1_FIELDS.naicsCode.x, PAGE_1_FIELDS.naicsCode.y, PAGE_1_FIELDS.naicsCode.size);
      }

      // SAM Registered
      if (responseData.samRegistered === true) {
        drawX(0, PAGE_1_FIELDS.samYes.x, PAGE_1_FIELDS.samYes.y);
      } else if (responseData.samRegistered === false) {
        drawX(0, PAGE_1_FIELDS.samNo.x, PAGE_1_FIELDS.samNo.y);
      }

      // Business Type
      if (responseData.businessType === "large") {
        drawX(0, PAGE_1_FIELDS.businessTypeLarge.x, PAGE_1_FIELDS.businessTypeLarge.y);
      } else if (responseData.businessType === "small") {
        drawX(0, PAGE_1_FIELDS.businessTypeSmall.x, PAGE_1_FIELDS.businessTypeSmall.y);
      }

      // Certifications
      if (responseData.smallDisadvantaged) drawX(0, PAGE_1_FIELDS.smallDisadvantaged.x, PAGE_1_FIELDS.smallDisadvantaged.y);
      if (responseData.womanOwned) drawX(0, PAGE_1_FIELDS.womanOwned.x, PAGE_1_FIELDS.womanOwned.y);
      if (responseData.veteranOwned) drawX(0, PAGE_1_FIELDS.veteranOwned.x, PAGE_1_FIELDS.veteranOwned.y);
      if (responseData.serviceDisabledVetOwned) drawX(0, PAGE_1_FIELDS.serviceDisabledVet.x, PAGE_1_FIELDS.serviceDisabledVet.y);
      if (responseData.hubZone) drawX(0, PAGE_1_FIELDS.hubZone.x, PAGE_1_FIELDS.hubZone.y);
      if (responseData.alaskaNative) drawX(0, PAGE_1_FIELDS.alaskaNative.x, PAGE_1_FIELDS.alaskaNative.y);
      if (responseData.otherSmallBusiness) drawX(0, PAGE_1_FIELDS.otherSmallBusiness.x, PAGE_1_FIELDS.otherSmallBusiness.y);

      // Employee Count
      const empMap: Record<string, { x: number; y: number }> = {
        "<500": PAGE_1_FIELDS.employeeLt500,
        "501-750": PAGE_1_FIELDS.employee501_750,
        "751-1000": PAGE_1_FIELDS.employee751_1000,
        "1001-1500": PAGE_1_FIELDS.employee1001_1500,
        ">1500": PAGE_1_FIELDS.employeeGt1500,
      };
      if (responseData.employeeCount && empMap[responseData.employeeCount]) {
        drawX(0, empMap[responseData.employeeCount].x, empMap[responseData.employeeCount].y);
      }
    }

    // ========== PAGE 2: Signature ==========
    if (pages.length >= 2) {
      if (responseData.authorizedSignature) {
        drawText(1, responseData.authorizedSignature, PAGE_2_FIELDS.authorizedSignature.x, PAGE_2_FIELDS.authorizedSignature.y, PAGE_2_FIELDS.authorizedSignature.size);
      }
      if (responseData.signatureDate) {
        const date = new Date(responseData.signatureDate);
        const formatted = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
        drawText(1, formatted, PAGE_2_FIELDS.signatureDate.x, PAGE_2_FIELDS.signatureDate.y, PAGE_2_FIELDS.signatureDate.size);
      }
    }

    // ========== PAGE 3: Line Items & Pricing ==========
    if (pages.length >= 3 && responseData.lineItems && responseData.lineItems.length > 0) {
      const item = responseData.lineItems[0]; // First item for now

      // Delivery Days
      if (item.deliveryDays) {
        drawText(2, `${item.deliveryDays} DAYS`, PAGE_3_FIELDS.deliveryDays.x, PAGE_3_FIELDS.deliveryDays.y, PAGE_3_FIELDS.deliveryDays.size);
      }

      // Country of Origin
      if (item.countryOfOrigin === "USA") {
        drawX(2, PAGE_3_FIELDS.countryOfOriginUSA.x, PAGE_3_FIELDS.countryOfOriginUSA.y);
      } else if (item.countryOfOrigin) {
        drawX(2, PAGE_3_FIELDS.countryOfOriginOther.x, PAGE_3_FIELDS.countryOfOriginOther.y);
        drawText(2, item.countryOfOrigin, PAGE_3_FIELDS.countryOfOriginOtherText.x, PAGE_3_FIELDS.countryOfOriginOtherText.y, PAGE_3_FIELDS.countryOfOriginOtherText.size);
      }

      // Exception Note (includes manufacturer)
      const exceptionText = item.manufacturer
        ? `MFR: ${item.manufacturer}`
        : item.exceptionNote || "";
      if (exceptionText) {
        drawText(2, exceptionText, PAGE_3_FIELDS.exceptionNote.x, PAGE_3_FIELDS.exceptionNote.y, PAGE_3_FIELDS.exceptionNote.size);
      }

      // Polchem questions
      if (item.isIawNsn !== undefined) {
        drawText(2, item.isIawNsn ? "Y" : "N", PAGE_3_FIELDS.isIawNsn.x, PAGE_3_FIELDS.isIawNsn.y, PAGE_3_FIELDS.isIawNsn.size);
      }
      if (item.minimumQty) {
        drawText(2, item.minimumQty, PAGE_3_FIELDS.minimumQtyRun.x, PAGE_3_FIELDS.minimumQtyRun.y, PAGE_3_FIELDS.minimumQtyRun.size);
      }
      if (item.qtyUnitPack) {
        drawText(2, item.qtyUnitPack, PAGE_3_FIELDS.qtyUnitPack.x, PAGE_3_FIELDS.qtyUnitPack.y, PAGE_3_FIELDS.qtyUnitPack.size);
      }

      // Price Breaks Table
      const tableRows = [
        PAGE_3_FIELDS.priceBreakTable.row1,
        PAGE_3_FIELDS.priceBreakTable.row2,
        PAGE_3_FIELDS.priceBreakTable.row3,
        PAGE_3_FIELDS.priceBreakTable.row4,
      ];

      item.priceBreaks.forEach((pb, idx) => {
        if (idx < tableRows.length) {
          const row = tableRows[idx];
          drawText(2, String(pb.fromQty), row.fromQty, row.y, 10);
          drawText(2, String(pb.toQty), row.toQty, row.y, 10);
          drawText(2, pb.unitCost, row.unitCost, row.y, 10);
          if (pb.deliveryDays) {
            drawText(2, pb.deliveryDays, row.delDays, row.y, 10);
          }
        }
      });
    }

    // Serialize the filled PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Upload to S3
    const timestamp = Date.now();
    const s3Key = `responses/${rfqId}-${timestamp}-filled.pdf`;
    const { url } = await uploadToS3(s3Key, pdfBuffer, 'application/pdf');

    // Save response record
    const [savedResponse] = await db.insert(rfqResponses).values({
      rfqDocumentId: rfqId,
      companyProfileId: profile?.id || null,
      responseData,
      generatedPdfS3Key: s3Key,
      generatedPdfUrl: url,
      status: 'completed',
      submittedAt: new Date(),
    }).returning();

    console.log(`PDF generated and saved. Response ID: ${savedResponse.id}`);

    return NextResponse.json({
      success: true,
      pdfUrl: url,
      responseId: savedResponse.id,
    });

  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}