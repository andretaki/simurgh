/**
 * NSN Catalog API
 * GET /api/nsn-catalog - Get catalog statistics and NSNs
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nsnCatalog } from "@/drizzle/migrations/schema";
import { eq, desc } from "drizzle-orm";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fsc = searchParams.get("fsc");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Build query
    let query;
    if (fsc) {
      query = db
        .select()
        .from(nsnCatalog)
        .where(eq(nsnCatalog.fsc, fsc))
        .orderBy(desc(nsnCatalog.updatedAt))
        .limit(limit);
    } else {
      query = db
        .select()
        .from(nsnCatalog)
        .orderBy(desc(nsnCatalog.updatedAt))
        .limit(limit);
    }

    const nsns = await query;

    // Calculate stats
    const allNsns = await db.select().from(nsnCatalog);
    const byFsc: Record<string, number> = {};
    for (const nsn of allNsns) {
      byFsc[nsn.fsc] = (byFsc[nsn.fsc] || 0) + 1;
    }

    const fscNames: Record<string, string> = {
      "6810": "Chemicals",
      "9150": "Oils and Greases",
      "6850": "Chemical Specialties",
      "8010": "Paints/Varnishes",
      "9160": "Misc Wax/Oils",
    };

    return apiSuccess({
      stats: {
        total: allNsns.length,
        byFsc,
      },
      nsns,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Failed to get NSN catalog: ${message}`, 500);
  }
}
