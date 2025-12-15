import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { governmentOrders, governmentOrderRfqLinks, rfqDocuments } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeRfqNumber } from "@/lib/rfq-number";

// POST /api/orders/upload - Upload PO PDF and extract data
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to base64 for Claude Vision
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Use Claude to extract PO data
    const extractedData = await extractPODataWithClaude(base64);

    const result = await db.transaction(async (tx) => {
      // Try to find and link to originating RFQ by RFQ number
      let linkedRfqDocumentId: number | null = null;
      const rfqNumber = normalizeRfqNumber(extractedData.rfqNumber);

      if (rfqNumber) {
        const [matchingRfq] = await tx
          .select()
          .from(rfqDocuments)
          .where(eq(rfqDocuments.rfqNumber, rfqNumber))
          .limit(1);

        if (matchingRfq) {
          linkedRfqDocumentId = matchingRfq.id;
          console.log(
            `Auto-linked PO to RFQ: ${rfqNumber} (rfqDocumentId: ${matchingRfq.id})`
          );
        } else {
          console.log(
            `RFQ number ${rfqNumber} found in PO but no matching RFQ document exists`
          );
        }
      }

      // Create order in database (legacy rfqDocumentId kept for now)
      const [newOrder] = await tx
        .insert(governmentOrders)
        .values({
          poNumber: extractedData.poNumber || "UNKNOWN",
          rfqNumber: rfqNumber,
          rfqDocumentId: linkedRfqDocumentId,
          productName: extractedData.productName || "Unknown Product",
          productDescription: extractedData.productDescription || null,
          grade: extractedData.grade || null,
          nsn: extractedData.nsn || null,
          nsnBarcode: extractedData.nsn ? extractedData.nsn.replace(/-/g, "") : null,
          quantity: extractedData.quantity || 1,
          unitOfMeasure: extractedData.unitOfMeasure || null,
          unitContents: extractedData.unitContents || null,
          unitPrice: extractedData.unitPrice || null,
          totalPrice: extractedData.totalPrice || null,
          spec: extractedData.spec || null,
          milStd: extractedData.milStd || null,
          shipToName: extractedData.shipToName || null,
          shipToAddress: extractedData.shipToAddress || null,
          deliveryDate: extractedData.deliveryDate ? new Date(extractedData.deliveryDate) : null,
          extractedData: extractedData,
          status: "pending",
        })
        .returning();

      // Store the relationship in the junction table (future-proof: many-to-many)
      if (linkedRfqDocumentId) {
        await tx.insert(governmentOrderRfqLinks).values({
          governmentOrderId: newOrder.id,
          rfqDocumentId: linkedRfqDocumentId,
        });
      }

      return { newOrder, rfqNumber, linkedRfqDocumentId };
    });

    return NextResponse.json({
      orderId: result.newOrder.id,
      extractedData,
      linkedRfqNumber: result.rfqNumber,
      linkedRfqDocumentId: result.linkedRfqDocumentId,
    });
  } catch (error) {
    console.error("Error processing PO upload:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}

async function extractPODataWithClaude(base64Pdf: string) {
  const anthropic = new Anthropic();

  const prompt = `You are a data extraction assistant. Extract the following information from this government Purchase Order document.

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
- deliveryDate: Delivery/required date if specified (ISO format)

Only return valid JSON, no markdown or explanations.
If a field is not found, use null.`;

  try {
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
              text: prompt,
            },
          ],
        },
      ],
    });

    // Parse the response
    const textContent = response.content.find((c: { type: string }) => c.type === "text");
    if (textContent && textContent.type === "text") {
      const jsonText = textContent.text.trim();
      // Remove markdown code blocks if present
      const cleanJson = jsonText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      return JSON.parse(cleanJson);
    }

    return {};
  } catch (error) {
    console.error("Error extracting PO data with Claude:", error);
    // Return empty object if extraction fails
    return {};
  }
}
