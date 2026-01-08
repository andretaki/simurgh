import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses, governmentOrders, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { eq, and, gte, lte, sql, isNull, not } from "drizzle-orm";

/**
 * Get quick stats for the boss's dashboard:
 * - Total open RFQs (processed, not yet responded to with a completed quote)
 * - Due today
 * - Due this week
 * - Recent wins (RFQs that got a PO in last 30 days)
 */
export async function GET() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Base conditions for valid RFQs
    const validRfqConditions = and(
      eq(rfqDocuments.status, "processed"),
      not(eq(rfqDocuments.fileName, "email_ingestion_checkpoint"))
    );

    // Run all counts in parallel
    const [openResult, dueTodayResult, dueSoonResult, winsResult] = await Promise.all([
      // Total open RFQs: processed RFQs that either have no response or response is not completed
      db
        .select({ count: sql<number>`count(DISTINCT ${rfqDocuments.id})` })
        .from(rfqDocuments)
        .leftJoin(rfqResponses, eq(rfqResponses.rfqDocumentId, rfqDocuments.id))
        .where(
          and(
            validRfqConditions,
            sql`(${rfqResponses.id} IS NULL OR ${rfqResponses.status} IS NULL OR ${rfqResponses.status} != 'completed')`
          )
        ),

      // Due today: processed RFQs with due date today
      db
        .select({ count: sql<number>`count(*)` })
        .from(rfqDocuments)
        .where(
          and(
            validRfqConditions,
            gte(rfqDocuments.dueDate, today),
            lte(rfqDocuments.dueDate, endOfToday)
          )
        ),

      // Due this week: processed RFQs with due date in next 7 days
      db
        .select({ count: sql<number>`count(*)` })
        .from(rfqDocuments)
        .where(
          and(
            validRfqConditions,
            gte(rfqDocuments.dueDate, today),
            lte(rfqDocuments.dueDate, endOfWeek)
          )
        ),

      // Recent wins: unique RFQs that resulted in POs in last 30 days
      db
        .select({ count: sql<number>`count(DISTINCT ${governmentOrderRfqLinks.rfqDocumentId})` })
        .from(governmentOrderRfqLinks)
        .innerJoin(governmentOrders, eq(governmentOrders.id, governmentOrderRfqLinks.governmentOrderId))
        .where(gte(governmentOrders.createdAt, thirtyDaysAgo)),
    ]);

    return NextResponse.json({
      totalOpen: Number(openResult[0]?.count || 0),
      dueToday: Number(dueTodayResult[0]?.count || 0),
      dueSoon: Number(dueSoonResult[0]?.count || 0),
      recentWins: Number(winsResult[0]?.count || 0),
    });

  } catch (error) {
    console.error("Stats error:", error);
    // Return zeros on error rather than failing
    return NextResponse.json({
      totalOpen: 0,
      dueToday: 0,
      dueSoon: 0,
      recentWins: 0,
    });
  }
}
