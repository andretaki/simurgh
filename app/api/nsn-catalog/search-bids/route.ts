/**
 * Search for SAM.gov bids matching NSNs
 * POST /api/nsn-catalog/search-bids
 */
import { NextRequest } from "next/server";
import { getSamGovClient, SamGovClient } from "@/lib/sam-gov/client";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const { nsns } = await request.json();

    if (!nsns || !Array.isArray(nsns) || nsns.length === 0) {
      return apiError("NSNs array required", 400);
    }

    const client = getSamGovClient();
    const dateRange = SamGovClient.getDateRange(60); // Last 60 days

    const matches: Array<{
      nsn: string;
      opportunities: Array<{
        solicitationNumber: string;
        title: string;
        responseDeadline: string;
        uiLink: string;
      }>;
    }> = [];

    // Search for each NSN
    for (const nsn of nsns.slice(0, 20)) {
      try {
        // Search by NSN in title/description
        const result = await client.searchOpportunities({
          postedFrom: dateRange.from,
          postedTo: dateRange.to,
          keywords: nsn,
          ptype: "o",
          limit: 10,
        });

        if (result.opportunities.length > 0) {
          // Filter to only active (not expired)
          const now = new Date();
          const activeOpps = result.opportunities.filter((opp) => {
            if (!opp.responseDeadline) return true;
            return new Date(opp.responseDeadline) >= now;
          });

          if (activeOpps.length > 0) {
            matches.push({
              nsn,
              opportunities: activeOpps.map((opp) => ({
                solicitationNumber: opp.solicitationNumber,
                title: opp.title,
                responseDeadline: opp.responseDeadline,
                uiLink: opp.uiLink,
              })),
            });
          }
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.error(`Error searching for NSN ${nsn}:`, err);
      }
    }

    return apiSuccess({
      searched: Math.min(nsns.length, 20),
      matches,
      totalMatches: matches.reduce((acc, m) => acc + m.opportunities.length, 0),
    });
  } catch (error) {
    console.error("Search error:", error);
    return apiError("Failed to search for bids", 500);
  }
}
