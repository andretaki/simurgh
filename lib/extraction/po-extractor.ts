import Anthropic from "@anthropic-ai/sdk";
import { normalizeRfqNumber } from "@/lib/rfq-number";

const anthropic = new Anthropic();

export interface PoExtractionResult {
  success: boolean;
  extractedData: Record<string, any>;
  poNumber: string | null;
  rfqNumber: string | null;
  error?: string;
}

const PO_EXTRACTION_PROMPT = `You are a data extraction assistant. Extract the following information from this government Purchase Order document.

Return a JSON object with these fields:
- poNumber: The PO/Order number (e.g., "821-45659232")
- rfqNumber: The RFQ/Solicitation number this PO is awarding (e.g., "821-36208263"). Government POs typically reference the original RFQ number. Look for "RFQ", "Solicitation", "Reference", or "In response to" fields.
- productName: Main product name (e.g., "LUBRICATING OIL, UTILITY")
- productDescription: Full product description including brand if mentioned
- grade: Product grade if specified (e.g., "TECHNICAL", "ACS")
- nsn: National Stock Number in format XXXX-XX-XXX-XXXX (e.g., "9150-00-045-4317")
- quantity: Numeric quantity ordered
- unitOfMeasure: Unit type (e.g., "CN", "BOX", "EA", "QT")
- unitContents: What each unit contains (e.g., "5.0 GALLONS", "12 x 1 QUART")
- unitPrice: Price per unit as a string (e.g., "159.85")
- totalPrice: Total order price as a string
- spec: Specification reference (e.g., "MIL-PRF-2104H", "O-E-760D")
- milStd: Military standard reference (e.g., "MIL-STD-290H")
- shipToName: Ship to company/facility name
- shipToAddress: Full shipping address
- deliveryDate: Delivery/required date if specified (ISO format YYYY-MM-DD)

Only return valid JSON, no markdown or explanations.
If a field is not found, use null.`;

/**
 * Extract PO data from a PDF buffer using Claude
 */
export async function extractPoFromPdf(pdfBuffer: Buffer): Promise<PoExtractionResult> {
  try {
    const base64Pdf = pdfBuffer.toString("base64");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              type: "text",
              text: PO_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c: { type: string }) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return {
        success: false,
        extractedData: {},
        poNumber: null,
        rfqNumber: null,
        error: "No text response from Claude",
      };
    }

    // Clean and parse JSON
    const cleanJson = textContent.text
      .trim()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const extractedData = JSON.parse(cleanJson);
    const rfqNumber = normalizeRfqNumber(extractedData.rfqNumber);

    return {
      success: true,
      extractedData,
      poNumber: extractedData.poNumber || null,
      rfqNumber,
    };
  } catch (error) {
    console.error("PO extraction error:", error);
    return {
      success: false,
      extractedData: {},
      poNumber: null,
      rfqNumber: null,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}

/**
 * Determines if a filename is a main PO document vs a packing list or other attachment
 */
export function isMainPoDocument(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();

  // Packing lists and other non-PO attachments
  const excludePatterns = [
    'packinglist',
    'packing_list',
    'packing-list',
    'shipping',
    'invoice',
    'receipt',
    'confirmation',
  ];

  for (const pattern of excludePatterns) {
    if (lowerName.includes(pattern)) {
      return false;
    }
  }

  // Main PO patterns
  const includePatterns = [
    'vendorpo',
    'vendor_po',
    'vendor-po',
    'purchaseorder',
    'purchase_order',
    'purchase-order',
    'po-',
    'po_',
  ];

  // If it matches a PO pattern, it's a main document
  for (const pattern of includePatterns) {
    if (lowerName.includes(pattern)) {
      return true;
    }
  }

  // Default: if it's a PDF and doesn't match exclude patterns, assume it's the main PO
  return lowerName.endsWith('.pdf');
}
