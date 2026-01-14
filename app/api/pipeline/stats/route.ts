import { db } from "@/lib/db";
import { governmentOrders, rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { sql, eq, and } from "drizzle-orm";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    // RFQs needing action (processed but not responded)
    const rfqsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqDocuments)
      .where(
        and(
          eq(rfqDocuments.status, "processed"),
          sql`NOT EXISTS (
            SELECT 1 FROM ${rfqResponses}
            WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
            AND ${rfqResponses.status} IN ('completed', 'submitted')
          )`
        )
      );

    // Total RFQs
    const totalRfqsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(rfqDocuments);

    // Orders not closed
    const ordersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(governmentOrders)
      .where(sql`${governmentOrders.stage} != 'closed' OR ${governmentOrders.stage} IS NULL`);

    // Total orders
    const totalOrdersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(governmentOrders);

    // Count by order stage
    const ordersByStage = await db
      .select({
        stage: governmentOrders.stage,
        count: sql<number>`count(*)`,
      })
      .from(governmentOrders)
      .groupBy(governmentOrders.stage);

    const stageCountsMap = Object.fromEntries(
      ordersByStage.map(s => [s.stage || 'received', Number(s.count)])
    );

    return apiSuccess({
      actionRequired: Number(rfqsResult[0]?.count || 0) + Number(ordersResult[0]?.count || 0),
      rfqs: Number(totalRfqsResult[0]?.count || 0),
      orders: Number(totalOrdersResult[0]?.count || 0),
      ordersByStage: stageCountsMap,
    });
  } catch (error) {
    logger.error("Error fetching pipeline stats", error);
    return apiError("Failed to fetch stats", 500);
  }
}
