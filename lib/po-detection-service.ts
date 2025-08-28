import { db } from "@/lib/db";
import { vendors } from "@/db/schema";
import { ilike } from "drizzle-orm";
import OpenAI from "openai";

const OPENAI_MODEL = 'gpt-5-mini-2025-08-07'; // GPT-5 mini - faster and more cost-efficient

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DocumentClassification {
  documentType: 'rfq' | 'po' | 'invoice' | 'quote' | 'other';
  confidence: number;
  poNumber?: string;
  vendorName?: string;
  rfqReference?: string;
  indicators: string[];
}

/**
 * Detect if a document is a Purchase Order based on its content
 */
export async function detectDocumentType(
  extractedText: string,
  emailSubject?: string,
  emailBody?: string
): Promise<DocumentClassification> {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a document classification expert. Analyze the provided text and determine if it's an RFQ, Purchase Order, Invoice, Quote, or other document type.
          
          Key indicators for each type:
          - RFQ: Contains "Request for Quote", "RFQ", solicitation language, asking for pricing
          - Purchase Order: Contains "Purchase Order", "PO #", vendor details, order confirmation, line items with committed prices
          - Invoice: Contains "Invoice", payment due date, invoice number, billed amounts
          - Quote: Contains "Quote", "Quotation", proposed pricing, validity period
          
          Return JSON with:
          {
            "documentType": "rfq" | "po" | "invoice" | "quote" | "other",
            "confidence": 0.0-1.0,
            "poNumber": "extracted PO number if applicable",
            "vendorName": "vendor/supplier name if found",
            "rfqReference": "referenced RFQ number if found",
            "indicators": ["list", "of", "key", "phrases", "found"]
          }`
        },
        {
          role: "user",
          content: `Email Subject: ${emailSubject || 'N/A'}
          
Email Body Preview: ${emailBody?.substring(0, 500) || 'N/A'}

Document Text (first 4000 chars):
${extractedText.substring(0, 4000)}`
        }
      ],
      temperature: 1, // GPT-5 mini only supports temperature=1
      max_completion_tokens: 500,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    
    return {
      documentType: result.documentType || 'other',
      confidence: result.confidence || 0,
      poNumber: result.poNumber,
      vendorName: result.vendorName,
      rfqReference: result.rfqReference,
      indicators: result.indicators || []
    };
  } catch (error) {
    console.error("Error detecting document type:", error);
    
    // Fallback to simple keyword detection
    const textLower = extractedText.toLowerCase();
    const subjectLower = (emailSubject || '').toLowerCase();
    
    if (textLower.includes('purchase order') || subjectLower.includes('purchase order') || 
        textLower.includes('po #') || subjectLower.includes('po #')) {
      return {
        documentType: 'po',
        confidence: 0.7,
        indicators: ['Keyword match: purchase order or PO #']
      };
    }
    
    if (textLower.includes('request for quote') || textLower.includes('rfq') ||
        subjectLower.includes('rfq')) {
      return {
        documentType: 'rfq',
        confidence: 0.7,
        indicators: ['Keyword match: RFQ or request for quote']
      };
    }
    
    if (textLower.includes('invoice')) {
      return {
        documentType: 'invoice',
        confidence: 0.7,
        indicators: ['Keyword match: invoice']
      };
    }
    
    return {
      documentType: 'other',
      confidence: 0.3,
      indicators: ['No clear document type indicators found']
    };
  }
}

/**
 * Extract Purchase Order fields from a document
 */
export async function extractPOFields(extractedText: string): Promise<any> {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `Extract Purchase Order information and return as JSON. Include:
          - poNumber: The PO number
          - vendorName: Vendor/supplier name
          - vendorAddress: Vendor address
          - orderDate: Order date (ISO format)
          - deliveryDate: Requested delivery date (ISO format)
          - buyerName: Buyer/purchaser name
          - buyerAddress: Buyer address
          - shipToAddress: Shipping address
          - billToAddress: Billing address
          - paymentTerms: Payment terms
          - shippingTerms: Shipping terms/method
          - lineItems: Array of items with: lineNumber, partNumber, description, quantity, unitPrice, totalPrice, unitOfMeasure
          - subtotal: Subtotal amount
          - taxAmount: Tax amount
          - shippingAmount: Shipping/freight amount
          - totalAmount: Total amount
          - notes: Any special instructions or notes
          - referenceNumbers: Any reference numbers (RFQ, quote, contract, etc.)
          
          If a field is not found, set it to null.`
        },
        {
          role: "user",
          content: extractedText.substring(0, 8000)
        }
      ],
      temperature: 1, // GPT-5 mini only supports temperature=1
      max_completion_tokens: 2500,
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error extracting PO fields:", error);
    throw error;
  }
}

/**
 * Match vendor name to existing vendor or suggest creating new one
 */
export async function matchOrCreateVendor(vendorName: string): Promise<{
  vendorId?: number;
  isNew: boolean;
  suggestedCode?: string;
}> {
  if (!vendorName) {
    return { isNew: false };
  }

  // Try to find existing vendor by name (case-insensitive)
  const existingVendor = await db
    .select()
    .from(vendors)
    .where(ilike(vendors.vendorName, vendorName))
    .limit(1)
    .then(rows => rows[0]);

  if (existingVendor) {
    return {
      vendorId: existingVendor.id,
      isNew: false
    };
  }

  // Generate a suggested vendor code
  const cleanName = vendorName.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const suggestedCode = cleanName.substring(0, 6) + Date.now().toString().slice(-4);

  return {
    isNew: true,
    suggestedCode
  };
}

/**
 * Find related RFQ based on RFQ number or other references
 */
export async function findRelatedRFQ(
  rfqReference?: string,
  vendorName?: string,
  orderDate?: Date
): Promise<{ rfqId?: number; confidence: number }> {
  if (rfqReference) {
    // Direct RFQ number match
    const rfq = await db.query.rfqDocuments.findFirst({
      where: (rfqDocuments, { eq }) => eq(rfqDocuments.rfqNumber, rfqReference)
    });

    if (rfq) {
      return { rfqId: rfq.id, confidence: 1.0 };
    }
  }

  // Try fuzzy matching based on vendor and date proximity
  // This would require more complex logic based on your business rules
  
  return { confidence: 0 };
}