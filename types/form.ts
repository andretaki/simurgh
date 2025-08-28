// types/form.ts

export interface PriceBreak {
  fromQty: string;
  toQty: string;
  unitCost: string;
  delDays: string;
}

export interface FormData {
  // Required fields
  productDescription?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  deliveryTimeline?: string;
  priceBreaks: PriceBreak[];
  paymentTerms?: string;
  quoteValidity?: string;
  additionalTerms?: string;
  authorizedSignature?: string;
  signatureDate?: string;

  // Business Classifications
  ANC?: string;
  CAGE?: string;
  HubZone?: string;
  NAICS?: string;
  NAICSSIZE?: string;
  SAMUEI?: string;
  SAM?: string;
  sdvet?: string;
  smalldisad?: string;
  vetowned?: string;
  womenowned?: string;
  hist?: string;
  other?: string;
  size?: string;
  BT?: string; // Business Type

  // Quote Details
  priceFirmUntil?: string;
  quoteRefNum?: string;
  paymentTermsOther?: string;

  // Shipping & Handling
  complimentaryFreight?: string;
  ppaByVender?: string;
  fob?: string;
  purchaseOrderMinimum?: string;

  // Special Instructions
  SpecInst7TextField1?: string;
  SpecInst8Checkbox1?: string;
  SpecInst8Checkbox2?: string;
  SpecInst8Checkbox3?: string;

  // Polchem Questions
  polchemQuestion1?: string;
  polchemQuestion2?: string;
  polchemQuestion3?: string;
  "polchemQuestion1-1"?: string;
  "polchemQuestion2-1"?: string;
  "polchemQuestion3-1"?: string;

  // No-bid Information
  noBidCode?: string;
  noBidReason?: string;
  "noBidReason-1"?: string;
  "noBidOther-1"?: string;

  // S006 Fields
  S006TextField1?: string;
  S006TextField2?: string;
  S006TextField3?: string;
  S006TextField4?: string;
  S006TextField5?: string;
  S006TextField6?: string;
  S006TextField7?: string;
  S006TextField8?: string;
  S006TextField9?: string;
  S006TextField10?: string;
  S006TextField11?: string;
  S006TextField12?: string;
  S006TextField13?: string;

  // Made In Information
  "madeIn-1"?: string;
  "madeInOther-1"?: string;

  // Exception Notes
  "exceptionNote-1"?: string;

  // Unit Cost and Delivery Days
  "unitCost-1"?: string;
  "deliveryDays-1"?: string;
}
