/**
 * Single Opportunity API
 * GET /api/opportunities/[id] - Get full details for an opportunity
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { samGovOpportunities } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { getSamGovClient } from "@/lib/sam-gov/client";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const oppId = parseInt(id);

    if (isNaN(oppId)) {
      return apiError("Invalid opportunity ID", 400);
    }

    // Get from database
    const dbResult = await db
      .select()
      .from(samGovOpportunities)
      .where(eq(samGovOpportunities.id, oppId))
      .limit(1);

    if (dbResult.length === 0) {
      return apiError("Opportunity not found", 404);
    }

    const opp = dbResult[0];

    // Try to get more details from SAM.gov API
    let details = null;
    try {
      const client = getSamGovClient();
      // Extract notice ID from uiLink or use solicitation number
      const noticeIdMatch = opp.uiLink?.match(/opp\/([a-f0-9]+)\//);
      const noticeId = noticeIdMatch ? noticeIdMatch[1] : null;

      if (noticeId) {
        details = await client.getOpportunityDetails(noticeId);
      }
    } catch (err) {
      console.error("Error fetching SAM.gov details:", err);
      // Continue with just database data
    }

    return apiSuccess({
      opportunity: opp,
      details,
    });
  } catch (error) {
    console.error("Error fetching opportunity:", error);
    return apiError("Failed to fetch opportunity", 500);
  }
}
