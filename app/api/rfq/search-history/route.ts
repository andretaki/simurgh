import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { eq, sql, desc } from "drizzle-orm";

/**
 * Search past RFQs by:
 * - nsnLast4: Last 4 digits of NSN (e.g., "7946")
 * - agent: Agent/POC name (e.g., "Johnson")
 *
 * Returns past RFQs with that NSN, including what price was quoted (if any)
 * Boss uses this to look up "what did we bid last time for NSN ending in 7946?"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nsnLast4 = searchParams.get("nsn")?.trim();
  const agent = searchParams.get("agent")?.trim();

  if (!nsnLast4 && !agent) {
    return NextResponse.json(
      { error: "Provide 'nsn' (last 4 digits) or 'agent' name" },
      { status: 400 }
    );
  }

  try {
    // Build dynamic WHERE conditions using raw SQL for JSON search
    const conditions = [];

    // Always exclude checkpoint entries
    conditions.push(sql`${rfqDocuments.fileName} != 'email_ingestion_checkpoint'`);

    if (nsnLast4) {
      // Search NSN ending in these digits within the JSON extractedFields
      // The NSN could be in rfqSummary.items[].nsn or items[].nsn
      conditions.push(
        sql`${rfqDocuments.extractedFields}::text ILIKE ${'%' + nsnLast4 + '%'}`
      );
    }

    if (agent) {
      // Search agent/POC name within the JSON extractedFields
      // Could be in rfqSummary.buyer.pocName or pocName
      conditions.push(
        sql`${rfqDocuments.extractedFields}::text ILIKE ${'%' + agent + '%'}`
      );
    }

    const whereClause = sql`${sql.join(conditions, sql` AND `)}`;

    const results = await db
      .select({
        id: rfqDocuments.id,
        fileName: rfqDocuments.fileName,
        rfqNumber: rfqDocuments.rfqNumber,
        dueDate: rfqDocuments.dueDate,
        contractingOffice: rfqDocuments.contractingOffice,
        extractedFields: rfqDocuments.extractedFields,
        createdAt: rfqDocuments.createdAt,
        responseId: rfqResponses.id,
        responseData: rfqResponses.responseData,
        responseStatus: rfqResponses.status,
      })
      .from(rfqDocuments)
      .leftJoin(rfqResponses, eq(rfqResponses.rfqDocumentId, rfqDocuments.id))
      .where(whereClause)
      .orderBy(desc(rfqDocuments.createdAt))
      .limit(50);

    // Format results for boss - extract the key info he needs
    const formatted = results.map((r) => {
      const fields = r.extractedFields as Record<string, unknown> | null;
      const rfqSummary = fields?.rfqSummary as Record<string, unknown> | undefined;
      const buyer = rfqSummary?.buyer as Record<string, unknown> | undefined;
      const items = (rfqSummary?.items || fields?.items || []) as Array<Record<string, unknown>>;
      const response = r.responseData as Record<string, unknown> | null;
      const responseLineItems = (response?.lineItems || []) as Array<Record<string, unknown>>;

      return {
        id: r.id,
        rfqNumber: r.rfqNumber,
        fileName: r.fileName,
        dueDate: r.dueDate,
        createdAt: r.createdAt,
        contractingOffice: r.contractingOffice,

        // Agent info
        agent: {
          name: (buyer?.pocName || fields?.pocName || null) as string | null,
          email: (buyer?.pocEmail || fields?.pocEmail || null) as string | null,
          phone: (buyer?.pocPhone || fields?.pocPhone || null) as string | null,
        },

        // Line items with past pricing
        items: items.map((item, idx) => {
          const nsn = item.nsn as string | undefined;
          const responseItem = responseLineItems[idx] || {};

          return {
            itemNumber: item.itemNumber || idx + 1,
            nsn: nsn || null,
            nsnLast4: nsn ? nsn.replace(/-/g, '').slice(-4) : null,
            partNumber: item.partNumber || null,
            description: (item.shortDescription || item.productType ||
                         (item.description ? String(item.description).substring(0, 100) : null)) as string | null,
            quantity: item.quantity,
            unit: item.unit || "EA",

            // What we quoted last time (if anything)
            quotedUnitCost: responseItem.unitCost || null,
            quotedDeliveryDays: responseItem.deliveryDays || null,
            wasNoBid: !!responseItem.noBidReason,
            noBidReason: responseItem.noBidReason || null,
          };
        }),

        // Response status
        responseStatus: r.responseStatus || "no_response",
        hadResponse: !!r.responseId,
      };
    });

    // Filter results to only include those with matching NSN if nsnLast4 was provided
    let filteredResults = formatted;
    if (nsnLast4) {
      filteredResults = formatted.filter(r =>
        r.items.some(item => item.nsnLast4 === nsnLast4 || item.nsn?.includes(nsnLast4))
      );
    }

    return NextResponse.json({
      query: { nsnLast4, agent },
      count: filteredResults.length,
      results: filteredResults,
    });

  } catch (error) {
    console.error("Search history error:", error);
    return NextResponse.json(
      { error: "Search failed", details: String(error) },
      { status: 500 }
    );
  }
}
