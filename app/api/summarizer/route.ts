// app/api/summarizer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: openaiApiKey });

if (!openaiApiKey) {
  console.error("Error: OpenAI API key is missing");
} else {
  console.log("OpenAI API Key Loaded Successfully");
}

export async function POST(request: NextRequest) {
  try {
    const { text, extractFields = false } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided." }, { status: 400 });
    }

    // Enhanced prompt for RFQ field extraction
    const systemContent = extractFields 
      ? `You are an RFQ document analyzer. Extract ALL form fields and information that a vendor would need to fill out.
      
      Format your response as follows:
      
      **SUMMARY**
      [Concise summary of the RFQ]
      
      **KEY DETAILS**
      RFQ Number: [number]
      Company Name: [company]
      RFQ Date: [date]
      Due Date: [date]
      
      **ITEMS REQUESTED**
      - [List each item/product]
      
      **FORM FIELDS TO COMPLETE**
      The following fields need to be filled by the vendor:
      - Price/Unit Cost fields
      - Delivery/Lead Time 
      - Payment Terms (Net 30, Net 15, etc.)
      - FOB (Origin/Destination)
      - Minimum Order Quantity
      - CAGE Code
      - SAM UEI
      - NAICS Code and Size
      - Business Type (Small/Large)
      - Business Classifications (Woman-owned, Veteran-owned, HUBZone, etc.)
      - Complimentary Freight (Yes/No)
      - Prepay & Add by Vendor (Yes/No)
      - Country of Origin/Made In
      - Any exceptions or special notes
      
      **SPECIAL REQUIREMENTS**
      [Any special certifications, compliance, or other requirements]`
      : "You are a summarization assistant specializing in RFQ and PO documents. Provide structured summaries with key details clearly labeled.";

    const userContent = extractFields
      ? `Extract all form fields and requirements from this RFQ document:\n\n${text}`
      : `Summarize the following text: ${text}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      max_tokens: 5000,
      temperature: 0.3, // Lower temperature for more consistent extraction
    });

    const summary =
      completion.choices[0]?.message?.content || "No summary generated";

    // If extracting fields, also parse the response to identify specific fields
    if (extractFields) {
      const fieldPatterns = {
        hasUnitCost: /price|cost|unit\s*cost|pricing/i.test(summary),
        hasDeliveryTime: /delivery|lead\s*time|days\s*aro/i.test(summary),
        hasPaymentTerms: /payment\s*terms|net\s*\d+/i.test(summary),
        hasFOB: /fob|freight/i.test(summary),
        hasCageCode: /cage\s*code/i.test(summary),
        hasSamUei: /sam\s*uei|sam\s*registration/i.test(summary),
        hasNaicsCode: /naics/i.test(summary),
        hasBusinessType: /business\s*type|small\s*business/i.test(summary),
        hasClassifications: /woman[\s-]owned|veteran[\s-]owned|hub\s*zone|disadvantaged/i.test(summary),
        hasMinimumOrder: /minimum\s*order|moq/i.test(summary),
      };

      return NextResponse.json({ 
        summary,
        extractedFields: fieldPatterns 
      });
    }

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
