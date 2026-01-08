// Prompt for extracting bid/quote data from completed RFQ response PDFs
// Used when user manually filled out pricing and we need to capture what was bid

export const BID_EXTRACTION_PROMPT = `You are an expert at extracting bid and quote information from completed RFQ (Request for Quote) response documents.

The document you are analyzing is a COMPLETED quote/bid response - meaning someone has already filled in pricing, delivery times, and other response fields. Your job is to extract what was bid/quoted.

From the completed RFQ response text, build ONE JSON object called "bidSummary" that captures all the bid information that was filled in.

Return ONLY valid JSON, no markdown or comments.

The JSON must have this structure exactly:

{
  "bidSummary": {
    "rfqNumber": "string or null - the RFQ number this is responding to",
    "quoteReferenceNumber": "string or null - vendor's quote/reference number",
    "quoteDate": "YYYY-MM-DD or null - date the quote was prepared",
    "pricesFirmUntil": "YYYY-MM-DD or null - how long prices are valid",
    "deliveryDays": "number or null - overall delivery days if specified",

    "vendor": {
      "companyName": "string or null",
      "contactName": "string or null",
      "phone": "string or null",
      "email": "string or null",
      "address": "string or null",
      "cageCode": "string or null",
      "samUei": "string or null"
    },

    "terms": {
      "paymentTerms": "string or null - e.g., 'Net 30', '2% 10 Net 30'",
      "fob": "string or null - 'origin' or 'destination'",
      "shippingCost": "string or null - e.g., 'included', 'prepay and add', 'no freight'",
      "minimumOrder": "string or null - minimum PO value if specified"
    },

    "lineItems": [
      {
        "itemNumber": "string - line item number from RFQ",
        "nsn": "string or null - NSN if visible",
        "partNumber": "string or null",
        "description": "string or null - brief description",
        "quantity": "number or null - quantity being quoted",
        "unitOfMeasure": "string or null - e.g., 'EA', 'GL', 'BX'",
        "unitPrice": "number or null - price per unit in dollars",
        "extendedPrice": "number or null - total price for line (qty x unit)",
        "deliveryDays": "number or null - delivery days for this item",
        "countryOfOrigin": "string or null",
        "manufacturer": "string or null",
        "noBid": "boolean - true if this item was marked as no-bid",
        "noBidReason": "string or null - reason if no-bid",
        "priceBreaks": [
          {
            "minQuantity": "number",
            "maxQuantity": "number or null",
            "unitPrice": "number"
          }
        ]
      }
    ],

    "certifications": {
      "smallBusiness": "boolean or null",
      "smallDisadvantaged": "boolean or null",
      "womanOwned": "boolean or null",
      "veteranOwned": "boolean or null",
      "serviceDisabledVeteran": "boolean or null",
      "hubZone": "boolean or null"
    },

    "totalQuoteAmount": "number or null - total quote value if visible",
    "notes": "string or null - any additional notes or comments on the quote"
  }
}

Important rules:
- Extract ONLY information that was actually filled in on the form.
- For pricing, capture the exact numbers - do NOT calculate or estimate.
- If a field is blank or not filled in, use null.
- For boolean fields, use true/false only if you can clearly determine the value, otherwise null.
- Dates must be ISO format YYYY-MM-DD when you can determine them.
- For unit prices, extract just the numeric value (e.g., 125.50 not "$125.50").
- If there are price breaks (volume discounts), capture each tier.
- If an item is marked "no bid" or declined, set noBid to true and capture the reason if given.
- Look for handwritten or typed-in values in form fields.
`;

// Type definitions for the extracted bid data
export interface BidLineItem {
  itemNumber: string;
  nsn: string | null;
  partNumber: string | null;
  description: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
  unitPrice: number | null;
  extendedPrice: number | null;
  deliveryDays: number | null;
  countryOfOrigin: string | null;
  manufacturer: string | null;
  noBid: boolean;
  noBidReason: string | null;
  priceBreaks: Array<{
    minQuantity: number;
    maxQuantity: number | null;
    unitPrice: number;
  }>;
}

export interface BidSummary {
  rfqNumber: string | null;
  quoteReferenceNumber: string | null;
  quoteDate: string | null;
  pricesFirmUntil: string | null;
  deliveryDays: number | null;
  vendor: {
    companyName: string | null;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    cageCode: string | null;
    samUei: string | null;
  };
  terms: {
    paymentTerms: string | null;
    fob: string | null;
    shippingCost: string | null;
    minimumOrder: string | null;
  };
  lineItems: BidLineItem[];
  certifications: {
    smallBusiness: boolean | null;
    smallDisadvantaged: boolean | null;
    womanOwned: boolean | null;
    veteranOwned: boolean | null;
    serviceDisabledVeteran: boolean | null;
    hubZone: boolean | null;
  };
  totalQuoteAmount: number | null;
  notes: string | null;
}

export interface ExtractedBidData {
  bidSummary: BidSummary;
}
