import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, getWorkflowStats, WorkflowStatus } from "@/lib/workflow-service";

/**
 * GET /api/workflow
 *
 * List all workflows with optional filtering
 *
 * Query params:
 * - status: Filter by workflow status
 * - limit: Max results (default 50)
 * - offset: Pagination offset
 * - stats: If "true", return stats instead of list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as WorkflowStatus | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const wantStats = searchParams.get("stats") === "true";

    // Return stats if requested
    if (wantStats) {
      const stats = await getWorkflowStats();
      return NextResponse.json(stats);
    }

    // Return list of workflows
    const workflows = await listWorkflows({
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      workflows,
      count: workflows.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error listing workflows:", error);
    return NextResponse.json(
      { error: "Failed to list workflows", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
