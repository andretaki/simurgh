// RFQ Response Builder
// Merges extracted RFQ data with company profile to create a pre-filled quote template

import { RfqSummary } from "./rfq-extraction-prompt";
import { CompanyProfile } from "./types/index";
import {
  ParsedRfqJson,
  ResponseData,
  BuildRfqResponseResult,
} from "./types/rfq-response";

/**
 * Build the three RFQ response sections:
 * 1. parsedJson - raw extracted RFQ data
 * 2. templatePayload - ResponseData with company boilerplate filled, pricing empty
 * 3. previewForBoss - human-readable summary
 */
export function buildRfqResponse(
  rfqSummary: RfqSummary,
  companyProfile: CompanyProfile
): BuildRfqResponseResult {
  const parsedJson = buildParsedJson(rfqSummary, companyProfile);
  const templatePayload = buildTemplatePayload(rfqSummary, companyProfile);
  const previewForBoss = buildPreviewForBoss(parsedJson, companyProfile);

  return {
    parsedJson,
    templatePayload,
    previewForBoss,
  };
}

/**
 * Build parsedJson from RfqSummary + CompanyProfile
 */
function buildParsedJson(
  rfqSummary: RfqSummary,
  companyProfile: CompanyProfile
): ParsedRfqJson {
  // Parse company address into lines
  const addressLines = companyProfile.address
    ? companyProfile.address.split(",").map((s) => s.trim())
    : [];

  return {
    rfqNumber: rfqSummary.header.rfqNumber,
    rfqDate: rfqSummary.header.rfqDate,
    quoteFirmUntil: rfqSummary.header.quoteFirmUntil,
    requiredDeliveryDate: rfqSummary.header.deliveryBeforeDate,
    requestedReplyDate: rfqSummary.header.requestedReplyDate,
    agencyName: rfqSummary.customerName || rfqSummary.buyer.contractingOffice,
    buyerContact: {
      name: rfqSummary.buyer.pocName,
      phone: rfqSummary.buyer.pocPhone,
      fax: rfqSummary.buyer.pocFax,
      email: rfqSummary.buyer.pocEmail,
    },
    supplier: {
      name: companyProfile.companyName,
      attention: companyProfile.contactPerson || null,
      addressLines,
      phone: companyProfile.contactPhone || null,
      fax: null, // Not in CompanyProfile schema
      email: companyProfile.contactEmail || null,
      cageCode: companyProfile.cageCode || null,
    },
    shipToAddress: null, // Not typically in RfqSummary header
    contractNumber: rfqSummary.buyer.primeContractNumber,
    paymentTermsRequested: rfqSummary.commercialTerms.paymentTerms,
    shippingCostInstruction: null, // Derived from commercialTerms
    fob: rfqSummary.commercialTerms.fob,
    naicsCode: companyProfile.naicsCode || null,
    businessType: companyProfile.businessType || null,
    lineItems: rfqSummary.items.map((item, index) => ({
      lineNumber: item.itemNumber || String(index + 1),
      nsnOrPartNumber: item.nsn || item.partNumber || null,
      itemDescription: item.shortDescription,
      unitOfMeasure: item.unitOfIssue || item.unit,
      quantityRequested: item.quantity,
    })),
  };
}

/**
 * Build templatePayload (ResponseData) from RfqSummary + CompanyProfile
 * Pricing fields are left empty for manual entry
 */
function buildTemplatePayload(
  rfqSummary: RfqSummary,
  companyProfile: CompanyProfile
): ResponseData {
  // Map payment terms
  let paymentTerms: "net45" | "other" = "other";
  let paymentTermsOther = companyProfile.defaultPaymentTerms || "";
  if (companyProfile.defaultPaymentTerms?.toLowerCase().includes("net 45")) {
    paymentTerms = "net45";
    paymentTermsOther = "";
  }

  // Map FOB
  let fob: "origin" | "destination" = "origin";
  if (companyProfile.defaultFob?.toLowerCase().includes("destination")) {
    fob = "destination";
  }

  // Map shipping cost
  let shippingCost: "noFreight" | "ppa" = "noFreight";
  if (companyProfile.defaultPpaByVendor) {
    shippingCost = "ppa";
  }

  // Map business type
  let businessType: "large" | "small" = "small";
  if (companyProfile.businessType?.toLowerCase() === "large") {
    businessType = "large";
  }

  // Map employee count
  let employeeCount = "<500";
  if (companyProfile.employeeCount) {
    const count = companyProfile.employeeCount;
    if (count.includes("500") || parseInt(count) < 500) {
      employeeCount = "<500";
    } else if (count.includes("750") || parseInt(count) <= 750) {
      employeeCount = "501-750";
    } else if (count.includes("1000") || parseInt(count) <= 1000) {
      employeeCount = "751-1000";
    } else if (count.includes("1500") || parseInt(count) <= 1500) {
      employeeCount = "1001-1500";
    } else {
      employeeCount = ">1500";
    }
  }

  // Calculate prices firm until date (30 days from now if not specified)
  let pricesFirmUntil = rfqSummary.header.quoteFirmUntil;
  if (!pricesFirmUntil) {
    const firmDate = new Date();
    firmDate.setDate(firmDate.getDate() + 30);
    pricesFirmUntil = firmDate.toISOString().split("T")[0];
  }

  // Build line items with empty pricing
  const lineItems = rfqSummary.items.map((item, index) => ({
    itemNumber: item.itemNumber || String(index + 1),
    unitCost: "", // EMPTY - boss fills this
    deliveryDays: "", // EMPTY - boss fills this
    countryOfOrigin: companyProfile.countryOfOrigin || "USA",
    manufacturer: companyProfile.companyName,
    isIawNsn: false, // Default, boss can change
    minimumQty: "",
    qtyUnitPack: "",
    exceptionNote: "",
    priceBreaks: [], // EMPTY - boss fills this
  }));

  return {
    pricesFirmUntil,
    quoteRefNum: rfqSummary.header.rfqNumber ? `RFQ-${rfqSummary.header.rfqNumber}` : undefined,
    paymentTerms,
    paymentTermsOther,
    shippingCost,
    fob,
    purchaseOrderMinimum: companyProfile.defaultPurchaseOrderMin || "",
    samUei: companyProfile.samUei || "",
    cageCode: companyProfile.cageCode || "",
    samRegistered: companyProfile.samRegistered ?? false,
    naicsCode: companyProfile.naicsCode || "",
    naicsSizeStandard: companyProfile.naicsSize || "",
    businessType,
    smallDisadvantaged: companyProfile.smallDisadvantaged ?? false,
    womanOwned: companyProfile.womanOwned ?? false,
    veteranOwned: companyProfile.veteranOwned ?? false,
    serviceDisabledVetOwned: companyProfile.serviceDisabledVetOwned ?? false,
    hubZone: companyProfile.hubZone ?? false,
    hbcu: companyProfile.historicallyUnderutilized ?? false,
    alaskaNative: companyProfile.alaskaNativeCorp ?? false,
    otherSmallBusiness: false,
    employeeCount,
    lineItems,
    authorizedSignature: companyProfile.contactPerson || "",
    signatureDate: new Date().toISOString().split("T")[0],
  };
}

/**
 * Build a human-readable preview for the boss to review
 */
function buildPreviewForBoss(
  parsedJson: ParsedRfqJson,
  companyProfile: CompanyProfile
): string {
  const lines: string[] = [];

  lines.push("RFQ preview for boss");
  lines.push("");
  lines.push("RFQ number:");
  lines.push(`  ${parsedJson.rfqNumber || "Not specified"}`);
  lines.push("");
  lines.push("Agency:");
  lines.push(`  ${parsedJson.agencyName || "Not specified"}`);
  lines.push("");
  lines.push("RFQ dates:");
  lines.push(`  RFQ date: ${formatDate(parsedJson.rfqDate)}`);
  lines.push(`  Quote firm until: ${formatDate(parsedJson.quoteFirmUntil)}`);
  lines.push(
    `  Required delivery before: ${formatDate(parsedJson.requiredDeliveryDate)}`
  );
  lines.push(
    `  Requested reply date: ${formatDate(parsedJson.requestedReplyDate)}`
  );
  lines.push("");
  lines.push("Agency contact:");
  lines.push(`  Name: ${parsedJson.buyerContact.name || "Not specified"}`);
  lines.push(`  Phone: ${parsedJson.buyerContact.phone || "Not specified"}`);
  lines.push(`  Fax:   ${parsedJson.buyerContact.fax || "Not specified"}`);
  lines.push(`  Email: ${parsedJson.buyerContact.email || "Not specified"}`);
  lines.push("");
  lines.push("Our company info:");
  lines.push(`  ${companyProfile.companyName}`);
  lines.push(`  CAGE: ${companyProfile.cageCode || "Not set"}`);
  lines.push(`  NAICS: ${companyProfile.naicsCode || "Not set"}`);
  lines.push(`  Business type: ${companyProfile.businessType || "Not set"}`);
  lines.push(
    `  Payment terms: ${companyProfile.defaultPaymentTerms || "Not set"}`
  );
  lines.push(`  FOB: ${companyProfile.defaultFob || "Not set"}`);
  lines.push(`  Address: ${companyProfile.address || "Not set"}`);
  lines.push(
    `  Contact: ${companyProfile.contactPerson || "Not set"}, ${companyProfile.contactPhone || ""}, ${companyProfile.contactEmail || ""}`
  );
  lines.push("");
  lines.push("Ship to:");
  lines.push(`  ${parsedJson.shipToAddress || "Not specified in this RFQ header"}`);
  lines.push("");
  lines.push("Line items:");

  parsedJson.lineItems.forEach((item, index) => {
    lines.push(
      `  ${index + 1}) Qty ${item.quantityRequested ?? "?"} ${item.unitOfMeasure || ""}`
    );
    lines.push(`     NSN / Part: ${item.nsnOrPartNumber || "Not specified"}`);
    lines.push(
      `     Description: ${truncate(item.itemDescription || "Not specified", 60)}`
    );
    lines.push(`     Unit price: [blank - to be filled]`);
    lines.push(`     Delivery days: [blank - to be filled]`);
  });

  return lines.join("\n");
}

/**
 * Format date from ISO to MM/DD/YY
 */
function formatDate(isoDate: string | null): string {
  if (!isoDate) return "Not specified";
  try {
    const date = new Date(isoDate);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  } catch {
    return isoDate;
  }
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
