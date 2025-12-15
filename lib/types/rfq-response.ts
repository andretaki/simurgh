// Types for RFQ-to-Quote response building
// Used by buildRfqResponse() to create parsedJson, templatePayload, and previewForBoss

/**
 * ParsedRfqJson - The raw extracted data from an RFQ document
 * Structured for human review and downstream processing
 */
export interface ParsedRfqJson {
  rfqNumber: string | null;
  rfqDate: string | null;
  quoteFirmUntil: string | null;
  requiredDeliveryDate: string | null;
  requestedReplyDate: string | null;
  agencyName: string | null;
  buyerContact: {
    name: string | null;
    phone: string | null;
    fax: string | null;
    email: string | null;
  };
  supplier: {
    name: string;
    attention: string | null;
    addressLines: string[];
    phone: string | null;
    fax: string | null;
    email: string | null;
    cageCode: string | null;
  };
  shipToAddress: string | null;
  contractNumber: string | null;
  paymentTermsRequested: string | null;
  shippingCostInstruction: string | null;
  fob: string | null;
  naicsCode: string | null;
  businessType: string | null;
  lineItems: Array<{
    lineNumber: string;
    nsnOrPartNumber: string | null;
    itemDescription: string | null;
    unitOfMeasure: string | null;
    quantityRequested: number | null;
  }>;
}

/**
 * ResponseData - The flat structure expected by POST /api/rfq/:id/generate
 * This is the templatePayload that gets sent to fill the ASRC quote PDF
 */
export interface ResponseData {
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

/**
 * BuildRfqResponseResult - The three sections returned by buildRfqResponse()
 */
export interface BuildRfqResponseResult {
  parsedJson: ParsedRfqJson;
  templatePayload: ResponseData;
  previewForBoss: string;
}
