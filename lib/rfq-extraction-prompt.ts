// Shared RFQ extraction prompt for Gemini AI
export const RFQ_EXTRACTION_PROMPT = `You are an expert at extracting information from government RFQ (Request for Quote) documents, particularly ASRC Federal and DLA formats.

From the RFQ text, build ONE JSON object called "rfqSummary" that contains only the information needed to decide if we should bid and to start preparing a bid.

Return ONLY valid JSON, no markdown or comments.

The JSON must have this structure exactly:

{
  "rfqSummary": {
    "rfqId": "string or null",
    "customerName": "string or null",
    "header": {
      "rfqNumber": "string or null",
      "rfqDate": "YYYY-MM-DD or null",
      "quoteFirmUntil": "YYYY-MM-DD or null",
      "requestedReplyDate": "YYYY-MM-DD or null",
      "deliveryBeforeDate": "YYYY-MM-DD or null"
    },
    "buyer": {
      "contractingOffice": "string or null",
      "primeContractNumber": "string or null",
      "pocName": "string or null",
      "pocEmail": "string or null",
      "pocPhone": "string or null",
      "pocFax": "string or null"
    },
    "items": [
      {
        "itemNumber": "string or null",
        "quantity": "number or null",
        "unit": "string or null",
        "shortDescription": "one or two sentence summary of what they are buying",
        "productType": "very short phrase like 'Aromatic naphtha solvent'",
        "nsn": "string or null",
        "partNumber": "string or null",
        "manufacturerPartNumber": "string or null",
        "unitOfIssue": "string or null",
        "specification": "string or null",
        "isHazmat": "boolean",
        "unNumber": "string or null"
      }
    ],
    "hazmat": {
      "isHazmat": "boolean",
      "unNumber": "string or null",
      "properShippingName": "string or null",
      "hazardClass": "string or null",
      "packingGroup": "string or null",
      "regulations": [
        "list of regulations mentioned such as '49 CFR', 'ICAO', 'IMDG', 'AFJMAN 24-204'"
      ]
    },
    "packaging": {
      "unitContainer": "short description of primary container requirements",
      "outerPackaging": "short description of required outer packaging / UN spec",
      "milStandards": [
        "list of MIL standards mentioned such as 'MIL-STD-129', 'MIL-STD-2073-1E'"
      ],
      "specialMarkings": [
        "bullet style strings of any special marking text or codes"
      ],
      "palletizationRequirements": "string or null"
    },
    "lotControl": {
      "lotControlRequired": "boolean",
      "lotMarkingText": "string or null",
      "lotSegregationRequired": "boolean"
    },
    "documentationRequired": [
      "short bullet strings like 'GHS compliant SDS', 'Hazard Warning Label (HWL)', 'Packaging performance test certificates'"
    ],
    "commercialTerms": {
      "fob": "string or null",
      "paymentTerms": "string or null"
    }
  }
}

Important rules:
- Fill every field you can directly from the RFQ text.
- Use null where the RFQ does not specify.
- Use true/false for all boolean fields.
- Do NOT invent data that is not clearly in the text.
- Dates must be ISO format YYYY-MM-DD when you can infer them.
- For item.shortDescription, keep it concise and human-readable.
- For the RFQ line item description in the PDF, you do NOT need to copy the entire paragraph into JSON; only capture what is important to understand what we must supply and how it must be packaged.
`;

// Type definitions for the extracted data
export interface RfqSummary {
  rfqId: string | null;
  customerName: string | null;
  header: {
    rfqNumber: string | null;
    rfqDate: string | null;
    quoteFirmUntil: string | null;
    requestedReplyDate: string | null;
    deliveryBeforeDate: string | null;
  };
  buyer: {
    contractingOffice: string | null;
    primeContractNumber: string | null;
    pocName: string | null;
    pocEmail: string | null;
    pocPhone: string | null;
    pocFax: string | null;
  };
  items: Array<{
    itemNumber: string | null;
    quantity: number | null;
    unit: string | null;
    shortDescription: string | null;
    productType: string | null;
    nsn: string | null;
    partNumber: string | null;
    manufacturerPartNumber: string | null;
    unitOfIssue: string | null;
    specification: string | null;
    isHazmat: boolean;
    unNumber: string | null;
  }>;
  hazmat: {
    isHazmat: boolean;
    unNumber: string | null;
    properShippingName: string | null;
    hazardClass: string | null;
    packingGroup: string | null;
    regulations: string[];
  };
  packaging: {
    unitContainer: string | null;
    outerPackaging: string | null;
    milStandards: string[];
    specialMarkings: string[];
    palletizationRequirements: string | null;
  };
  lotControl: {
    lotControlRequired: boolean;
    lotMarkingText: string | null;
    lotSegregationRequired: boolean;
  };
  documentationRequired: string[];
  commercialTerms: {
    fob: string | null;
    paymentTerms: string | null;
  };
}

export interface ExtractedRfqData {
  rfqSummary: RfqSummary;
}
