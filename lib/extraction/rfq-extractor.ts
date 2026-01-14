import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import { RFQ_EXTRACTION_PROMPT, ExtractedRfqData } from "@/lib/rfq-extraction-prompt";
import { normalizeRfqNumber } from "@/lib/rfq-number";
import { parseAiJsonSafe } from "@/lib/utils/parse-ai-json";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export interface RfqExtractionResult {
  success: boolean;
  extractedText: string;
  extractedFields: Record<string, unknown>;
  rfqNumber: string | null;
  contractingOffice: string | null;
  dueDate: Date | null;
  error?: string;
}

/**
 * Extract RFQ data from a PDF buffer using Gemini
 */
export async function extractRfqFromPdf(pdfBuffer: Buffer): Promise<RfqExtractionResult> {
  try {
    // Extract text from PDF
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length < 100) {
      return {
        success: false,
        extractedText: extractedText || "",
        extractedFields: {},
        rfqNumber: null,
        contractingOffice: null,
        dueDate: null,
        error: "PDF contains insufficient text content",
      };
    }

    // Use Gemini to extract structured RFQ data
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                RFQ_EXTRACTION_PROMPT +
                "\n\nHere is the RFQ document text to extract from:\n\n" +
                extractedText.substring(0, 30000),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8000,
      },
    });

    const completion = result.response;
    const content = completion.text() || "{}";

    // Parse AI response with robust markdown stripping
    const parseResult = parseAiJsonSafe<Record<string, unknown>>(content);
    if (!parseResult.success) {
      console.error("Failed to parse Gemini response:", parseResult.error);
      return {
        success: false,
        extractedText: extractedText.substring(0, 10000),
        extractedFields: { parseError: true },
        rfqNumber: null,
        contractingOffice: null,
        dueDate: null,
        error: `Failed to parse AI extraction response: ${parseResult.error}`,
      };
    }

    const extractedFields = parseResult.data || {};

    // Extract key fields from the structured response
    const rfqSummary = (extractedFields as unknown as ExtractedRfqData).rfqSummary;
    const header = rfqSummary?.header;
    const buyer = rfqSummary?.buyer;

    const rfqNumber = normalizeRfqNumber(header?.rfqNumber);
    const contractingOffice = buyer?.contractingOffice || null;

    // Parse due date
    let dueDate: Date | null = null;
    const dueDateStr = header?.requestedReplyDate || header?.quoteFirmUntil;
    if (dueDateStr) {
      const parsed = new Date(dueDateStr);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed;
      }
    }

    return {
      success: true,
      extractedText: extractedText.substring(0, 10000),
      extractedFields,
      rfqNumber,
      contractingOffice,
      dueDate,
    };
  } catch (error) {
    console.error("RFQ extraction error:", error);
    return {
      success: false,
      extractedText: "",
      extractedFields: {},
      rfqNumber: null,
      contractingOffice: null,
      dueDate: null,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}
