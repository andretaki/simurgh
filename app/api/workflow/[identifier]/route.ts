import { NextRequest, NextResponse } from "next/server";
import { getWorkflow } from "@/lib/workflow-service";

/**
 * GET /api/workflow/:identifier
 *
 * Get a complete workflow by RFQ number, PO number, or document ID
 *
 * Returns the full chain: RFQ → Response → PO → Quality Sheet → Labels
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { identifier: string } }
) {
  try {
    const { identifier } = params;

    if (!identifier) {
      return NextResponse.json(
        { error: "Identifier is required (RFQ number, PO number, or document ID)" },
        { status: 400 }
      );
    }

    const workflow = await getWorkflow(identifier);

    if (!workflow) {
      return NextResponse.json(
        { error: `No workflow found for identifier: ${identifier}` },
        { status: 404 }
      );
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Error getting workflow:", error);
    return NextResponse.json(
      { error: "Failed to get workflow", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
