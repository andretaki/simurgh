/**
 * SAM.gov Price Lookup Service
 *
 * Provides historical pricing intelligence from SAM.gov Contract Awards API.
 * Uses NSN/PSC to find similar contracts and calculate price ranges.
 */

import { db } from "@/lib/db";
import { samGovAwardCache } from "@/drizzle/migrations/schema";
import { eq, and, gte, desc, sql, like, or } from "drizzle-orm";
import { getSamGovClient, SamGovClient, ContractAward } from "./client";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface PriceLookupParams {
  nsn?: string; // National Stock Number (e.g., 6810-01-234-5678)
  psc?: string; // Product Service Code (e.g., 6810)
  naicsCode?: string; // NAICS code
  keywords?: string[]; // Keywords to search in description
  lookbackDays?: number; // How many days back to search (default: 730 = 2 years)
}

export interface PricingResult {
  found: boolean;
  message: string;
  awards: AwardSummary[];
  statistics: PriceStatistics | null;
  confidence: "high" | "medium" | "low" | "none";
  searchParams: PriceLookupParams;
  dataSource: "cache" | "api" | "none";
}

export interface AwardSummary {
  contractNumber: string;
  awardDate: string;
  totalValue: number;
  unitPrice: number | null;
  quantity: number | null;
  awardeeName: string;
  awardeeCage: string;
  agency: string;
  description: string;
}

export interface PriceStatistics {
  count: number;
  minUnitPrice: number;
  maxUnitPrice: number;
  avgUnitPrice: number;
  medianUnitPrice: number;
  minTotalValue: number;
  maxTotalValue: number;
  avgTotalValue: number;
  recentTrend: "up" | "down" | "stable" | "unknown";
}

// ============================================================================
// NSN/PSC Mapping
// ============================================================================

/**
 * Federal Supply Class (FSC) to Product Service Code (PSC) mapping
 * FSC is the first 4 digits of an NSN
 * PSC codes starting with same digits are related
 */
const FSC_TO_PSC_MAP: Record<string, string[]> = {
  "6810": ["6810", "6840", "6850"], // Chemicals
  "6820": ["6820"], // Dyes
  "6830": ["6830"], // Gases
  "6840": ["6840", "6810"], // Pest control agents
  "6850": ["6850", "6810"], // Miscellaneous chemical specialties
};

/**
 * Extract PSC codes from an NSN
 */
export function nsnToPscCodes(nsn: string): string[] {
  // Remove dashes and get FSC (first 4 digits)
  const cleaned = nsn.replace(/-/g, "");
  const fsc = cleaned.substring(0, 4);

  // Get related PSC codes
  return FSC_TO_PSC_MAP[fsc] || [fsc];
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Store awards in the cache
 */
async function cacheAwards(awards: ContractAward[]): Promise<void> {
  for (const award of awards) {
    try {
      // Extract keywords from description
      const keywords = extractKeywords(award.description);

      await db
        .insert(samGovAwardCache)
        .values({
          contractNumber: award.contractNumber,
          productServiceCode: award.productServiceCode,
          naicsCode: award.naicsCode,
          descriptionKeywords: keywords,
          awardDate: award.awardDate ? new Date(award.awardDate) : null,
          totalValue: award.totalValue?.toString() || null,
          actionObligation: award.actionObligation?.toString() || null,
          quantity: award.quantity,
          unitPrice: award.unitPrice?.toString() || null,
          awardeeName: award.awardeeName,
          awardeeCage: award.awardeeCage,
          awardeeUei: award.awardeeUei,
          contractingAgency: award.contractingAgency,
          description: award.description,
          rawData: award.rawData,
        })
        .onConflictDoNothing();
    } catch (error) {
      // Ignore duplicate key errors
      logger.debug("Could not cache award (likely duplicate)", {
        contractNumber: award.contractNumber,
      });
    }
  }
}

/**
 * Extract keywords from description for matching
 */
function extractKeywords(description: string): string[] {
  if (!description) return [];

  // Common chemical-related keywords
  const chemicalKeywords = [
    "acid",
    "base",
    "solvent",
    "reagent",
    "solution",
    "compound",
    "chemical",
    "hydrochloric",
    "sulfuric",
    "sodium",
    "potassium",
    "hydroxide",
    "nitric",
    "phosphoric",
    "acetone",
    "methanol",
    "ethanol",
    "isopropyl",
    "toluene",
    "xylene",
  ];

  const words = description
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  return words.filter(
    (w) => chemicalKeywords.some((kw) => w.includes(kw)) || words.indexOf(w) < 10
  );
}

/**
 * Get cached awards matching the criteria
 */
async function getCachedAwards(
  params: PriceLookupParams
): Promise<typeof samGovAwardCache.$inferSelect[]> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - (params.lookbackDays || 730));

  const conditions = [];

  // Filter by PSC codes
  if (params.psc) {
    conditions.push(eq(samGovAwardCache.productServiceCode, params.psc));
  } else if (params.nsn) {
    const pscCodes = nsnToPscCodes(params.nsn);
    if (pscCodes.length === 1) {
      conditions.push(eq(samGovAwardCache.productServiceCode, pscCodes[0]));
    } else {
      conditions.push(
        or(...pscCodes.map((psc) => eq(samGovAwardCache.productServiceCode, psc)))
      );
    }
  }

  // Filter by NAICS
  if (params.naicsCode) {
    conditions.push(eq(samGovAwardCache.naicsCode, params.naicsCode));
  }

  // Filter by date
  conditions.push(gte(samGovAwardCache.awardDate, lookbackDate));

  const query = conditions.length > 0
    ? db
        .select()
        .from(samGovAwardCache)
        .where(and(...conditions))
        .orderBy(desc(samGovAwardCache.awardDate))
        .limit(100)
    : db
        .select()
        .from(samGovAwardCache)
        .where(gte(samGovAwardCache.awardDate, lookbackDate))
        .orderBy(desc(samGovAwardCache.awardDate))
        .limit(100);

  return query;
}

// ============================================================================
// Price Calculation
// ============================================================================

/**
 * Calculate statistics from awards
 */
function calculateStatistics(awards: AwardSummary[]): PriceStatistics | null {
  if (awards.length === 0) return null;

  // Get unit prices (filter out nulls)
  const unitPrices = awards
    .map((a) => a.unitPrice)
    .filter((p): p is number => p !== null && p > 0)
    .sort((a, b) => a - b);

  const totalValues = awards
    .map((a) => a.totalValue)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  if (unitPrices.length === 0 && totalValues.length === 0) {
    return null;
  }

  // Calculate unit price stats
  const minUnitPrice = unitPrices.length > 0 ? unitPrices[0] : 0;
  const maxUnitPrice = unitPrices.length > 0 ? unitPrices[unitPrices.length - 1] : 0;
  const avgUnitPrice =
    unitPrices.length > 0
      ? unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length
      : 0;
  const medianUnitPrice =
    unitPrices.length > 0
      ? unitPrices[Math.floor(unitPrices.length / 2)]
      : 0;

  // Calculate total value stats
  const minTotalValue = totalValues.length > 0 ? totalValues[0] : 0;
  const maxTotalValue =
    totalValues.length > 0 ? totalValues[totalValues.length - 1] : 0;
  const avgTotalValue =
    totalValues.length > 0
      ? totalValues.reduce((a, b) => a + b, 0) / totalValues.length
      : 0;

  // Calculate trend (compare first half to second half)
  let recentTrend: "up" | "down" | "stable" | "unknown" = "unknown";
  if (unitPrices.length >= 4) {
    const midpoint = Math.floor(unitPrices.length / 2);
    const olderAvg =
      unitPrices.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
    const newerAvg =
      unitPrices.slice(midpoint).reduce((a, b) => a + b, 0) /
      (unitPrices.length - midpoint);

    const changePercent = ((newerAvg - olderAvg) / olderAvg) * 100;
    if (changePercent > 5) {
      recentTrend = "up";
    } else if (changePercent < -5) {
      recentTrend = "down";
    } else {
      recentTrend = "stable";
    }
  }

  return {
    count: awards.length,
    minUnitPrice,
    maxUnitPrice,
    avgUnitPrice,
    medianUnitPrice,
    minTotalValue,
    maxTotalValue,
    avgTotalValue,
    recentTrend,
  };
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidence(
  awards: AwardSummary[],
  stats: PriceStatistics | null
): "high" | "medium" | "low" | "none" {
  if (!stats || awards.length === 0) return "none";

  // High: 10+ awards with unit prices, recent data
  if (awards.length >= 10 && stats.minUnitPrice > 0) {
    const hasRecent = awards.some((a) => {
      const awardDate = new Date(a.awardDate);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return awardDate > sixMonthsAgo;
    });
    if (hasRecent) return "high";
  }

  // Medium: 5+ awards or has unit prices
  if (awards.length >= 5 || stats.minUnitPrice > 0) {
    return "medium";
  }

  // Low: Some data but limited
  if (awards.length > 0) {
    return "low";
  }

  return "none";
}

// ============================================================================
// Main Lookup Function
// ============================================================================

/**
 * Look up historical pricing for NSN/PSC
 */
export async function lookupPricing(
  params: PriceLookupParams
): Promise<PricingResult> {
  const result: PricingResult = {
    found: false,
    message: "",
    awards: [],
    statistics: null,
    confidence: "none",
    searchParams: params,
    dataSource: "none",
  };

  try {
    // First, try to get from cache
    const cachedAwards = await getCachedAwards(params);

    if (cachedAwards.length > 0) {
      result.dataSource = "cache";
      result.awards = cachedAwards.map((award) => ({
        contractNumber: award.contractNumber,
        awardDate: award.awardDate?.toISOString() || "",
        totalValue: parseFloat(award.totalValue || "0"),
        unitPrice: award.unitPrice ? parseFloat(award.unitPrice) : null,
        quantity: award.quantity,
        awardeeName: award.awardeeName || "",
        awardeeCage: award.awardeeCage || "",
        agency: award.contractingAgency || "",
        description: award.description || "",
      }));
    }

    // If cache is empty or stale, try API
    if (cachedAwards.length < 5 && SamGovClient.isConfigured()) {
      try {
        const client = getSamGovClient();
        const dateRange = SamGovClient.getDateRange(params.lookbackDays || 730);

        // Determine PSC codes to search
        let pscCodes: string[] = [];
        if (params.psc) {
          pscCodes = [params.psc];
        } else if (params.nsn) {
          pscCodes = nsnToPscCodes(params.nsn);
        }

        if (pscCodes.length > 0) {
          const apiResponse = await client.searchAwards({
            signedDateFrom: dateRange.from,
            signedDateTo: dateRange.to,
            productOrServiceCodes: pscCodes,
            naicsCode: params.naicsCode,
            limit: 50,
          });

          // Cache the results
          await cacheAwards(apiResponse.awards);

          // Add to results (deduplicate)
          const existingContracts = new Set(result.awards.map((a) => a.contractNumber));
          for (const award of apiResponse.awards) {
            if (!existingContracts.has(award.contractNumber)) {
              result.awards.push({
                contractNumber: award.contractNumber,
                awardDate: award.awardDate,
                totalValue: award.totalValue,
                unitPrice: award.unitPrice,
                quantity: award.quantity,
                awardeeName: award.awardeeName,
                awardeeCage: award.awardeeCage,
                agency: award.contractingAgency,
                description: award.description,
              });
            }
          }

          if (apiResponse.awards.length > 0) {
            result.dataSource = "api";
          }
        }
      } catch (apiError) {
        logger.warn("Failed to fetch from SAM.gov API, using cache only", {
          error: apiError,
        });
      }
    }

    // Calculate statistics
    result.statistics = calculateStatistics(result.awards);
    result.confidence = determineConfidence(result.awards, result.statistics);
    result.found = result.awards.length > 0;

    // Set message
    if (result.found) {
      const priceRange =
        result.statistics && result.statistics.minUnitPrice > 0
          ? `$${result.statistics.minUnitPrice.toFixed(2)} - $${result.statistics.maxUnitPrice.toFixed(2)}`
          : "varies";
      result.message = `Found ${result.awards.length} similar awards. Price range: ${priceRange}`;
    } else {
      result.message = "No historical pricing data found for this item.";
    }

    return result;
  } catch (error) {
    logger.error("Price lookup failed", { error, params });
    result.message =
      error instanceof Error ? error.message : "Price lookup failed";
    return result;
  }
}
