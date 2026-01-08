import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, governmentOrders } from "@/drizzle/migrations/schema";
import { getIngestionHealth } from "@/lib/email-ingestion-tracker";
import { sql, eq, gte, and, or } from "drizzle-orm";

export const dynamic = 'force-dynamic';

/**
 * Get email processing status and stats
 * GET /api/admin/email-status
 */
export async function GET(request: NextRequest) {
  try {
    // Check for API key (optional for admin)
    const apiKey = request.headers.get("x-api-key");
    const expectedKey = process.env.EMAIL_POLL_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      // For browser access, allow without key but could add session auth here
    }

    // Get ingestion health
    const health = await getIngestionHealth();

    // Get today's start timestamp
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count RFQs processed today (from email)
    const rfqsToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqDocuments)
      .where(
        and(
          gte(rfqDocuments.createdAt, today),
          sql`${rfqDocuments.extractedFields}->>'emailId' IS NOT NULL`
        )
      );

    // Count POs processed today (from email)
    const posToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(governmentOrders)
      .where(
        and(
          gte(governmentOrders.createdAt, today),
          sql`${governmentOrders.extractedData}->>'emailId' IS NOT NULL`
        )
      );

    // Get extraction failures (documents with extraction_failed status)
    const rfqFailures = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        error: rfqDocuments.processingError,
        createdAt: rfqDocuments.createdAt,
      })
      .from(rfqDocuments)
      .where(eq(rfqDocuments.status, "extraction_failed"))
      .orderBy(sql`${rfqDocuments.createdAt} DESC`)
      .limit(10);

    const poFailures = await db
      .select({
        id: governmentOrders.id,
        poNumber: governmentOrders.poNumber,
        error: sql<string>`${governmentOrders.extractedData}->>'extractionError'`,
        createdAt: governmentOrders.createdAt,
      })
      .from(governmentOrders)
      .where(eq(governmentOrders.status, "extraction_failed"))
      .orderBy(sql`${governmentOrders.createdAt} DESC`)
      .limit(10);

    // Get total counts
    const totalRfqs = await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqDocuments)
      .where(sql`${rfqDocuments.extractedFields}->>'emailId' IS NOT NULL`);

    const totalPos = await db
      .select({ count: sql<number>`count(*)` })
      .from(governmentOrders)
      .where(sql`${governmentOrders.extractedData}->>'emailId' IS NOT NULL`);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health: {
        status: health.healthy ? "healthy" : "unhealthy",
        lastSuccessfulRun: health.lastRun?.toISOString() || null,
        consecutiveFailures: health.consecutiveFailures,
        alert: health.alert,
        nextLookback: {
          days: health.nextLookback.lookbackDays,
          reason: health.nextLookback.reason,
        },
      },
      today: {
        rfqsProcessed: Number(rfqsToday[0]?.count || 0),
        posProcessed: Number(posToday[0]?.count || 0),
      },
      totals: {
        rfqsFromEmail: Number(totalRfqs[0]?.count || 0),
        posFromEmail: Number(totalPos[0]?.count || 0),
      },
      failures: {
        rfqs: rfqFailures.map(f => ({
          id: f.id,
          fileName: f.fileName,
          error: f.error,
          createdAt: f.createdAt?.toISOString(),
        })),
        pos: poFailures.map(f => ({
          id: f.id,
          poNumber: f.poNumber,
          error: f.error,
          createdAt: f.createdAt?.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Error getting email status:", error);
    return NextResponse.json(
      { error: "Failed to get email status", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
