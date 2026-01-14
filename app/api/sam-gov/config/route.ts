/**
 * SAM.gov Configuration Endpoint
 *
 * GET /api/sam-gov/config - Get current configuration
 * POST /api/sam-gov/config - Create or update configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { getSyncConfig, upsertSyncConfig } from "@/lib/sam-gov/opportunity-sync";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { SamGovClient } from "@/lib/sam-gov/client";

export async function GET() {
  try {
    const config = await getSyncConfig();
    const isApiKeyConfigured = SamGovClient.isConfigured();

    return apiSuccess({
      config: config || {
        naicsCodes: ["424690"],
        keywords: [],
        excludedKeywords: [],
        agencies: [],
        setAsideTypes: [],
        minValue: null,
        enabled: false,
        syncIntervalHours: 1,
        notificationEmail: null,
        lastSyncAt: null,
      },
      isApiKeyConfigured,
    });
  } catch (error) {
    logger.error("Failed to get SAM.gov config", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Failed to get config: ${message}`, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (body.enabled && !SamGovClient.isConfigured()) {
      return apiError(
        "Cannot enable sync: SAM_GOV_API_KEY is not configured",
        400
      );
    }

    const config = await upsertSyncConfig({
      naicsCodes: body.naicsCodes,
      keywords: body.keywords,
      excludedKeywords: body.excludedKeywords,
      agencies: body.agencies,
      setAsideTypes: body.setAsideTypes,
      minValue: body.minValue,
      enabled: body.enabled,
      syncIntervalHours: body.syncIntervalHours,
      notificationEmail: body.notificationEmail,
    });

    logger.info("SAM.gov config updated", {
      enabled: config.enabled,
      naicsCodes: config.naicsCodes,
    });

    return apiSuccess({
      message: "Configuration saved",
      config,
    });
  } catch (error) {
    logger.error("Failed to update SAM.gov config", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Failed to update config: ${message}`, 500);
  }
}
