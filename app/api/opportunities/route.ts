/**
 * Opportunities API
 * GET /api/opportunities - List opportunities with filtering
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { samGovOpportunities } from "@/drizzle/migrations/schema";
import { desc } from "drizzle-orm";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minScore = parseInt(searchParams.get("minScore") || "0");
    const showExpired = searchParams.get("showExpired") === "true";
    const nsnOnly = searchParams.get("nsnOnly") === "true";
    const fscOnly = searchParams.get("fscOnly") === "true";

    // Get opportunities
    const allOpps = await db
      .select()
      .from(samGovOpportunities)
      .orderBy(desc(samGovOpportunities.relevanceScore), desc(samGovOpportunities.responseDeadline));

    const now = new Date();

    // Filter out expired unless requested
    let filtered = allOpps.filter(o => {
      // Filter expired
      if (!showExpired && o.responseDeadline) {
        const deadline = new Date(o.responseDeadline);
        if (deadline < now) return false;
      }
      // Filter by score
      if (minScore > 0 && (o.relevanceScore || 0) < minScore) {
        return false;
      }
      // Filter NSN only (has matched NSNs from our catalog)
      if (nsnOnly) {
        const matchedNsns = o.matchedNsns as string[] | null;
        if (!matchedNsns || matchedNsns.length === 0) return false;
      }
      // Filter FSC only (has FSC match but no direct NSN match)
      if (fscOnly) {
        const matchedNsns = o.matchedNsns as string[] | null;
        const hasNsn = matchedNsns && matchedNsns.length > 0;
        if (hasNsn) return false; // Exclude NSN matches from FSC filter
        if (!o.matchedFsc) return false;
      }
      return true;
    });

    // Calculate stats (excluding expired)
    const activeOpps = allOpps.filter(o => {
      if (!o.responseDeadline) return true;
      return new Date(o.responseDeadline) >= now;
    });

    const stats = {
      total: activeOpps.length,
      high: activeOpps.filter(o => (o.relevanceScore || 0) >= 50).length,
      nsnMatch: activeOpps.filter(o => {
        const matchedNsns = o.matchedNsns as string[] | null;
        return matchedNsns && matchedNsns.length > 0;
      }).length,
      fscMatch: activeOpps.filter(o => {
        const matchedNsns = o.matchedNsns as string[] | null;
        const hasNsn = matchedNsns && matchedNsns.length > 0;
        // FSC match = has FSC but no direct NSN match
        return !hasNsn && o.matchedFsc;
      }).length,
    };

    return apiSuccess({
      opportunities: filtered,
      stats,
    });
  } catch (error) {
    console.error("Error fetching opportunities:", error);
    return apiError("Failed to fetch opportunities", 500);
  }
}
