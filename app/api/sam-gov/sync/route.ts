/**
 * SAM.gov Opportunity Sync Endpoint
 *
 * GET /api/sam-gov/sync - Run opportunity sync (for cron jobs, requires API key)
 * POST /api/sam-gov/sync - Manual sync trigger (from UI, requires same-origin)
 *
 * SECURITY:
 * - GET requires SAM_GOV_SYNC_API_KEY header for cron/external calls
 * - POST only allowed from same-origin requests (browser UI)
 * - Both respect rate limits from SAM.gov API
 */

import { NextRequest, NextResponse } from "next/server";
import { syncOpportunities } from "@/lib/sam-gov/opportunity-sync";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// API key required for cron/external access
const SYNC_API_KEY = process.env.SAM_GOV_SYNC_API_KEY;

/**
 * GET - For cron jobs / external triggers
 * REQUIRES: x-api-key header matching SAM_GOV_SYNC_API_KEY
 */
export async function GET(request: NextRequest) {
  // API key is REQUIRED for GET requests (cron/external)
  if (!SYNC_API_KEY) {
    logger.warn("SAM.gov sync GET attempted but SAM_GOV_SYNC_API_KEY not configured");
    return apiError(
      "SAM_GOV_SYNC_API_KEY not configured. Set this environment variable to enable cron sync.",
      503
    );
  }

  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== SYNC_API_KEY) {
    logger.warn("SAM.gov sync GET attempted with invalid API key");
    return apiError("Unauthorized", 401);
  }

  try {
    logger.info("SAM.gov sync triggered via GET (cron)");
    const result = await syncOpportunities();

    if (!result.success && result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Sync completed with errors",
          result,
        },
        { status: 207 } // Multi-Status
      );
    }

    return apiSuccess({
      message: "Sync completed successfully",
      result,
    });
  } catch (error) {
    logger.error("SAM.gov sync failed", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Sync failed: ${message}`, 500);
  }
}

/**
 * POST - For manual UI triggers
 * Allowed from same-origin requests (browser sessions with valid referer)
 */
export async function POST(request: NextRequest) {
  // For POST, verify this is a same-origin request (from our UI)
  // This prevents external POST requests without the cron API key
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // Allow if:
  // 1. Has valid origin header matching our host
  // 2. OR has API key (allows programmatic access)
  const hasValidOrigin = origin && host && (
    origin === `https://${host}` ||
    origin === `http://${host}` ||
    origin.includes("localhost")
  );

  const hasApiKey = SYNC_API_KEY && request.headers.get("x-api-key") === SYNC_API_KEY;

  if (!hasValidOrigin && !hasApiKey) {
    logger.warn("SAM.gov sync POST attempted from external origin", { origin, host, referer });
    return apiError("Forbidden - must be called from application UI or with API key", 403);
  }

  try {
    logger.info("SAM.gov sync triggered via POST (manual)", { origin });
    const result = await syncOpportunities();

    if (!result.success && result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Sync completed with errors",
          result,
        },
        { status: 207 }
      );
    }

    return apiSuccess({
      message: "Sync completed successfully",
      result,
    });
  } catch (error) {
    logger.error("SAM.gov sync failed", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Sync failed: ${message}`, 500);
  }
}
