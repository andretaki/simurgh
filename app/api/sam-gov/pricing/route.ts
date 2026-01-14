/**
 * SAM.gov Pricing Lookup Endpoint
 *
 * GET /api/sam-gov/pricing?nsn=6810-01-234-5678
 * GET /api/sam-gov/pricing?psc=6810&naics=424690
 *
 * Returns historical pricing data for competitive intelligence.
 */

import { NextRequest } from "next/server";
import { lookupPricing } from "@/lib/sam-gov/price-lookup";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const nsn = searchParams.get("nsn") || undefined;
    const psc = searchParams.get("psc") || undefined;
    const naicsCode = searchParams.get("naics") || searchParams.get("naicsCode") || undefined;
    const keywords = searchParams.get("keywords")?.split(",").filter(Boolean) || undefined;
    const lookbackDays = searchParams.get("lookbackDays")
      ? parseInt(searchParams.get("lookbackDays")!, 10)
      : undefined;

    // Require at least one search parameter
    if (!nsn && !psc && !naicsCode && !keywords) {
      return apiError(
        "At least one search parameter is required: nsn, psc, naics, or keywords",
        400
      );
    }

    logger.info("SAM.gov pricing lookup", { nsn, psc, naicsCode, keywords });

    const result = await lookupPricing({
      nsn,
      psc,
      naicsCode,
      keywords,
      lookbackDays,
    });

    return apiSuccess(result);
  } catch (error) {
    logger.error("SAM.gov pricing lookup failed", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Pricing lookup failed: ${message}`, 500);
  }
}
