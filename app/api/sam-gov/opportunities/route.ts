/**
 * SAM.gov Opportunities Endpoint
 *
 * GET /api/sam-gov/opportunities - List opportunities
 * PATCH /api/sam-gov/opportunities - Update opportunity status
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getRecentOpportunities,
  updateOpportunityStatus,
} from "@/lib/sam-gov/opportunity-sync";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const status = searchParams.get("status") || undefined;

    const opportunities = await getRecentOpportunities(limit, status);

    return apiSuccess({
      opportunities,
      count: opportunities.length,
    });
  } catch (error) {
    logger.error("Failed to get SAM.gov opportunities", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Failed to get opportunities: ${message}`, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return apiError("Missing opportunity ID", 400);
    }

    if (!body.status) {
      return apiError("Missing status", 400);
    }

    const validStatuses = ["new", "reviewed", "imported", "dismissed"];
    if (!validStatuses.includes(body.status)) {
      return apiError(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }

    await updateOpportunityStatus(
      body.id,
      body.status,
      body.dismissedReason
    );

    logger.info("Updated SAM.gov opportunity status", {
      id: body.id,
      status: body.status,
    });

    return apiSuccess({
      message: "Status updated",
      id: body.id,
      status: body.status,
    });
  } catch (error) {
    logger.error("Failed to update SAM.gov opportunity", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError(`Failed to update opportunity: ${message}`, 500);
  }
}
