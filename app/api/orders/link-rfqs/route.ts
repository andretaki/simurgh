import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, governmentOrders, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Link POs to RFQs based on rfqNumber
 * POST /api/orders/link-rfqs
 */
export async function POST(request: NextRequest) {
  try {
    // Find POs that have rfqNumber but aren't linked
    const unlinkedPOs = await db
      .select({
        id: governmentOrders.id,
        poNumber: governmentOrders.poNumber,
        rfqNumber: governmentOrders.rfqNumber,
        rfqDocumentId: governmentOrders.rfqDocumentId,
      })
      .from(governmentOrders)
      .where(and(
        isNotNull(governmentOrders.rfqNumber),
        sql`${governmentOrders.rfqDocumentId} IS NULL`
      ));

    console.log(`Found ${unlinkedPOs.length} POs with rfqNumber but no linked RFQ`);

    const results: Array<{
      poId: number;
      poNumber: string | null;
      rfqNumber: string | null;
      status: string;
      rfqDocumentId?: number;
    }> = [];

    for (const po of unlinkedPOs) {
      if (!po.rfqNumber) continue;

      // Try exact match first
      let [matchingRfq] = await db
        .select()
        .from(rfqDocuments)
        .where(eq(rfqDocuments.rfqNumber, po.rfqNumber))
        .limit(1);

      // If no exact match, try partial match (RFQ numbers often have "821 - " prefix)
      if (!matchingRfq) {
        const numericPart = po.rfqNumber.replace(/[^0-9]/g, "");
        [matchingRfq] = await db
          .select()
          .from(rfqDocuments)
          .where(sql`${rfqDocuments.rfqNumber} LIKE ${"%" + numericPart}`)
          .limit(1);
      }

      if (matchingRfq) {
        // Update the PO with the linked RFQ
        await db.update(governmentOrders)
          .set({ rfqDocumentId: matchingRfq.id })
          .where(eq(governmentOrders.id, po.id));

        // Create junction table entry
        await db.insert(governmentOrderRfqLinks).values({
          governmentOrderId: po.id,
          rfqDocumentId: matchingRfq.id,
        }).onConflictDoNothing();

        results.push({
          poId: po.id,
          poNumber: po.poNumber,
          rfqNumber: po.rfqNumber,
          status: "linked",
          rfqDocumentId: matchingRfq.id,
        });
      } else {
        results.push({
          poId: po.id,
          poNumber: po.poNumber,
          rfqNumber: po.rfqNumber,
          status: "no_matching_rfq",
        });
      }
    }

    const linkedCount = results.filter(r => r.status === "linked").length;
    const notFoundCount = results.filter(r => r.status === "no_matching_rfq").length;

    return NextResponse.json({
      message: `Linked ${linkedCount} POs to RFQs`,
      linked: linkedCount,
      notFound: notFoundCount,
      results,
    });

  } catch (error) {
    console.error("Error linking RFQs to POs:", error);
    return NextResponse.json(
      { error: "Failed to link RFQs to POs", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check unlinked PO count
 */
export async function GET(request: NextRequest) {
  try {
    const unlinkedPOs = await db
      .select({
        id: governmentOrders.id,
        poNumber: governmentOrders.poNumber,
        rfqNumber: governmentOrders.rfqNumber,
      })
      .from(governmentOrders)
      .where(and(
        isNotNull(governmentOrders.rfqNumber),
        sql`${governmentOrders.rfqDocumentId} IS NULL`
      ));

    return NextResponse.json({
      unlinkedPOCount: unlinkedPOs.length,
      pos: unlinkedPOs.map(po => ({
        id: po.id,
        poNumber: po.poNumber,
        rfqNumber: po.rfqNumber,
      })),
    });

  } catch (error) {
    console.error("Error checking unlinked POs:", error);
    return NextResponse.json(
      { error: "Failed to check unlinked POs" },
      { status: 500 }
    );
  }
}
