import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, rfqDocuments, governmentOrders } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST - Compare RFQ and PO using AI
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);

    // Get project and related documents
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get RFQ data
    let rfqData = null;
    if (project.rfqDocumentId) {
      const [rfq] = await db
        .select()
        .from(rfqDocuments)
        .where(eq(rfqDocuments.id, project.rfqDocumentId));
      rfqData = rfq?.extractedFields;
    }

    // Get PO data
    let poData = null;
    if (project.governmentOrderId) {
      const [po] = await db
        .select()
        .from(governmentOrders)
        .where(eq(governmentOrders.id, project.governmentOrderId));
      poData = po;
    }

    if (!rfqData && !poData) {
      return NextResponse.json(
        { error: "No documents to compare. Upload both RFQ and PO first." },
        { status: 400 }
      );
    }

    // Use Claude to compare the documents
    const prompt = `You are comparing an RFQ (Request for Quote) and a PO (Purchase Order) to verify they match.

RFQ Data:
${JSON.stringify(rfqData, null, 2)}

PO Data:
${JSON.stringify(poData, null, 2)}

Compare these documents and identify:
1. MATCHES - Fields that match between RFQ and PO
2. MISMATCHES - Fields that don't match (potential issues)
3. MISSING - Fields present in one but not the other

Focus on key fields:
- NSN (National Stock Number)
- Product Name/Description
- Quantity
- Unit of Measure
- Price/Unit Price
- Delivery Address
- Specification (MIL-STD, etc.)

Respond in this exact JSON format:
{
  "overallStatus": "matched" | "mismatched" | "partial",
  "summary": "Brief summary of comparison",
  "matches": [
    {"field": "field_name", "rfqValue": "value", "poValue": "value"}
  ],
  "mismatches": [
    {"field": "field_name", "rfqValue": "value", "poValue": "value", "severity": "high" | "medium" | "low", "note": "explanation"}
  ],
  "missing": [
    {"field": "field_name", "presentIn": "rfq" | "po", "value": "value"}
  ],
  "recommendations": ["List of action items if any"]
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract the JSON response
    const textContent = response.content.find((c) => c.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "";

    // Parse JSON from response
    let comparisonResults;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        comparisonResults = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      comparisonResults = {
        overallStatus: "partial",
        summary: responseText,
        matches: [],
        mismatches: [],
        missing: [],
        recommendations: [],
      };
    }

    // Save comparison results to project
    await db
      .update(projects)
      .set({
        comparisonResults,
        comparisonStatus: comparisonResults.overallStatus,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    return NextResponse.json({
      comparison: comparisonResults,
      rfqData,
      poData,
    });
  } catch (error) {
    console.error("Error comparing documents:", error);
    return NextResponse.json(
      { error: "Failed to compare documents" },
      { status: 500 }
    );
  }
}
