import { NextRequest, NextResponse } from "next/server";
import { getIngestionHealth } from "@/lib/email-ingestion-tracker";

/**
 * Health check endpoint for email ingestion monitoring
 * GET /api/email/health
 */
export async function GET(request: NextRequest) {
  try {
    const health = await getIngestionHealth();
    
    // Set appropriate HTTP status based on health
    const status = health.healthy ? 200 : health.consecutiveFailures >= 3 ? 503 : 200;
    
    return NextResponse.json(health, { status });
  } catch (error) {
    return NextResponse.json(
      {
        healthy: false,
        error: "Failed to get health status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}