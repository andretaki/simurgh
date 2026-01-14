/**
 * SAM.gov Opportunity Sync Service
 *
 * Fetches contract opportunities from SAM.gov based on configured filters
 * and stores them in the database for review.
 */

import { db } from "@/lib/db";
import {
  samGovSyncConfig,
  samGovOpportunities,
  nsnCatalog,
} from "@/drizzle/migrations/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { getSamGovClient, SamGovClient, Opportunity } from "./client";
import { logger } from "@/lib/logger";
import { createGraphClient, getMonitoredUserId } from "@/lib/microsoft-graph/auth";

// ============================================================================
// Types
// ============================================================================

export interface SyncConfig {
  id: number;
  naicsCodes: string[] | null;
  keywords: string[] | null;
  excludedKeywords: string[] | null;
  agencies: string[] | null;
  setAsideTypes: string[] | null;
  minValue: number | null;
  enabled: boolean | null;
  syncIntervalHours: number | null;
  notificationEmail: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  totalOpportunitiesFound: number | null;
}

export interface SyncResult {
  success: boolean;
  newOpportunities: number;
  totalFound: number;
  errors: string[];
  skipped: number;
}

// ============================================================================
// Sync Configuration
// ============================================================================

/**
 * Get the current sync configuration (or create default if none exists)
 */
export async function getSyncConfig(): Promise<SyncConfig | null> {
  const configs = await db.select().from(samGovSyncConfig).limit(1);

  if (configs.length === 0) {
    return null;
  }

  return configs[0] as SyncConfig;
}

/**
 * Create or update sync configuration
 */
export async function upsertSyncConfig(
  config: Partial<Omit<SyncConfig, "id" | "lastSyncAt">>
): Promise<SyncConfig> {
  const existing = await getSyncConfig();

  if (existing) {
    // Update existing config
    const [updated] = await db
      .update(samGovSyncConfig)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where(eq(samGovSyncConfig.id, existing.id))
      .returning();

    return updated as SyncConfig;
  } else {
    // Create new config
    const [created] = await db
      .insert(samGovSyncConfig)
      .values({
        naicsCodes: config.naicsCodes || ["424690"],
        keywords: config.keywords || [],
        excludedKeywords: config.excludedKeywords || [],
        agencies: config.agencies || [],
        setAsideTypes: config.setAsideTypes || [],
        minValue: config.minValue || null,
        enabled: config.enabled ?? true,
        syncIntervalHours: config.syncIntervalHours || 1,
        notificationEmail: config.notificationEmail || null,
      })
      .returning();

    return created as SyncConfig;
  }
}

// ============================================================================
// Opportunity Sync
// ============================================================================

/**
 * Check if an opportunity matches the configured filters
 */
function matchesFilters(
  opportunity: Opportunity,
  config: SyncConfig
): boolean {
  // Check NAICS code
  if (config.naicsCodes && config.naicsCodes.length > 0) {
    if (!config.naicsCodes.includes(opportunity.naicsCode)) {
      return false;
    }
  }

  // Check excluded keywords in title/description
  if (config.excludedKeywords && config.excludedKeywords.length > 0) {
    const text = `${opportunity.title} ${opportunity.description}`.toLowerCase();
    for (const keyword of config.excludedKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        return false;
      }
    }
  }

  // Check set-aside type
  if (config.setAsideTypes && config.setAsideTypes.length > 0) {
    if (
      opportunity.setAsideType &&
      !config.setAsideTypes.includes(opportunity.setAsideType)
    ) {
      return false;
    }
  }

  // Check minimum value (if award info is available)
  if (config.minValue && opportunity.award) {
    if (opportunity.award.amount < config.minValue) {
      return false;
    }
  }

  return true;
}

/**
 * Truncate string to max length
 */
function truncate(str: string | null | undefined, maxLength: number): string | null {
  if (!str) return null;
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

/**
 * Store an opportunity in the database
 */
async function storeOpportunity(opportunity: Opportunity): Promise<boolean> {
  try {
    // Check if already exists
    const existing = await db
      .select()
      .from(samGovOpportunities)
      .where(eq(samGovOpportunities.solicitationNumber, opportunity.solicitationNumber))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(samGovOpportunities)
        .set({
          title: opportunity.title,
          description: opportunity.description,
          responseDeadline: opportunity.responseDeadline
            ? new Date(opportunity.responseDeadline)
            : null,
          naicsCode: opportunity.naicsCode,
          setAsideType: opportunity.setAsideType,
          agency: opportunity.agency,
          office: opportunity.office,
          pocName: truncate(opportunity.pointOfContact[0]?.name, 255),
          pocEmail: truncate(opportunity.pointOfContact[0]?.email, 255),
          pocPhone: truncate(opportunity.pointOfContact[0]?.phone, 50),
          uiLink: opportunity.uiLink,
          attachments: opportunity.attachments,
          awardAmount: opportunity.award?.amount?.toString() || null,
          awardeeName: truncate(opportunity.award?.awardee, 255),
          awardDate: opportunity.award?.awardDate
            ? new Date(opportunity.award.awardDate)
            : null,
          rawData: opportunity.rawData,
          updatedAt: new Date(),
        })
        .where(eq(samGovOpportunities.solicitationNumber, opportunity.solicitationNumber));

      return false; // Not a new opportunity
    }

    // Insert new opportunity
    await db.insert(samGovOpportunities).values({
      solicitationNumber: opportunity.solicitationNumber,
      title: opportunity.title,
      description: opportunity.description,
      postedDate: opportunity.postedDate ? new Date(opportunity.postedDate) : null,
      responseDeadline: opportunity.responseDeadline
        ? new Date(opportunity.responseDeadline)
        : null,
      naicsCode: truncate(opportunity.naicsCode, 10),
      setAsideType: truncate(opportunity.setAsideType, 100),
      agency: truncate(opportunity.agency, 255),
      office: truncate(opportunity.office, 255),
      pocName: truncate(opportunity.pointOfContact[0]?.name, 255),
      pocEmail: truncate(opportunity.pointOfContact[0]?.email, 255),
      pocPhone: truncate(opportunity.pointOfContact[0]?.phone, 50),
      uiLink: opportunity.uiLink,
      attachments: opportunity.attachments,
      awardAmount: opportunity.award?.amount?.toString() || null,
      awardeeName: truncate(opportunity.award?.awardee, 255),
      awardDate: opportunity.award?.awardDate
        ? new Date(opportunity.award.awardDate)
        : null,
      rawData: opportunity.rawData,
      status: "new",
    });

    return true; // New opportunity
  } catch (error) {
    logger.error("Failed to store opportunity", {
      solicitationNumber: opportunity.solicitationNumber,
      error,
    });
    return false;
  }
}

/**
 * Send notification email for new opportunities via Microsoft Graph API
 *
 * IMPORTANT: This uses app-only (client credentials) authentication.
 * The Azure AD app registration must have:
 * - Mail.Send as an APPLICATION permission (not Delegated)
 * - Admin consent granted for Mail.Send
 *
 * Without these, sendMail will fail with 403 Forbidden.
 */
async function sendNotification(
  opportunities: Opportunity[],
  email: string
): Promise<void> {
  if (opportunities.length === 0) return;

  const subject = `[SAM.gov] ${opportunities.length} New Contract Opportunities Found`;

  const opportunityList = opportunities
    .map(
      (opp) =>
        `<li><strong>${opp.title}</strong><br/>
        Solicitation: ${opp.solicitationNumber}<br/>
        Agency: ${opp.agency}<br/>
        Deadline: ${opp.responseDeadline || "Not specified"}<br/>
        <a href="${opp.uiLink}">View on SAM.gov</a></li>`
    )
    .join("\n");

  const body = `
<h2>New Contract Opportunities</h2>
<p>New contract opportunities matching your filters have been found on SAM.gov:</p>
<ul>
${opportunityList}
</ul>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings/sam-gov">View all opportunities in Simurgh</a></p>
<hr/>
<p style="color: #666; font-size: 12px;">This is an automated notification from Simurgh.</p>
  `.trim();

  const client = createGraphClient();
  let userId: string;

  try {
    userId = await getMonitoredUserId(client);
  } catch (error) {
    logger.error("Failed to get user ID for notification email", { error });
    return;
  }

  try {
    await client.api(`/users/${userId}/sendMail`).post({
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: email,
            },
          },
        ],
      },
      saveToSentItems: true,
    });

    logger.info("Sent SAM.gov notification email via Graph", {
      to: email,
      count: opportunities.length,
    });
  } catch (error: unknown) {
    // Provide actionable error messages for common permission issues
    const graphError = error as { statusCode?: number; code?: string; message?: string };

    if (graphError.statusCode === 403 || graphError.code === "Authorization_RequestDenied") {
      logger.error("SAM.gov notification email failed: Missing Mail.Send APPLICATION permission", {
        error,
        hint: "Ensure Mail.Send is added as an Application permission (not Delegated) in Azure AD and admin consent is granted",
      });
    } else if (graphError.statusCode === 400 && graphError.message?.includes("saveToSentItems")) {
      // saveToSentItems may fail without MailboxSettings.ReadWrite permission - retry without it
      logger.warn("saveToSentItems failed, retrying without it", { error });
      try {
        await client.api(`/users/${userId}/sendMail`).post({
          message: {
            subject,
            body: { contentType: "HTML", content: body },
            toRecipients: [{ emailAddress: { address: email } }],
          },
          saveToSentItems: false,
        });
        logger.info("Sent SAM.gov notification email (without saving to sent)", { to: email });
        return;
      } catch (retryError) {
        logger.error("SAM.gov notification email retry failed", { retryError });
      }
    } else {
      logger.error("Failed to send SAM.gov notification email", { error });
    }
  }
}

/**
 * Run the opportunity sync
 */
export async function syncOpportunities(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    newOpportunities: 0,
    totalFound: 0,
    errors: [],
    skipped: 0,
  };

  try {
    // Get sync config
    const config = await getSyncConfig();

    if (!config) {
      result.errors.push("No sync configuration found. Please configure SAM.gov settings.");
      return result;
    }

    if (!config.enabled) {
      result.errors.push("SAM.gov sync is disabled.");
      return result;
    }

    // Check if API key is configured
    if (!SamGovClient.isConfigured()) {
      result.errors.push("SAM_GOV_API_KEY is not configured.");
      return result;
    }

    const client = getSamGovClient();

    // Calculate date range (last 7 days by default, or since last sync)
    const dateRange = config.lastSyncAt
      ? {
          from: SamGovClient.formatOpportunityDate(config.lastSyncAt),
          to: SamGovClient.formatOpportunityDate(new Date()),
        }
      : SamGovClient.getDateRange(7);

    logger.info("Starting SAM.gov opportunity sync", {
      dateRange,
      naicsCodes: config.naicsCodes,
      keywords: config.keywords,
    });

    // Fetch opportunities for each NAICS code (API only accepts one at a time)
    const naicsCodes = config.naicsCodes || ["424690"];
    const newOpportunities: Opportunity[] = [];

    for (const naicsCode of naicsCodes) {
      try {
        const response = await client.searchOpportunities({
          postedFrom: dateRange.from,
          postedTo: dateRange.to,
          naicsCodes: [naicsCode],
          keywords: config.keywords?.join(" ") || undefined,
          limit: 100,
        });

        result.totalFound += response.totalRecords;

        for (const opportunity of response.opportunities) {
          // Check if it matches all filters
          if (!matchesFilters(opportunity, config)) {
            result.skipped++;
            continue;
          }

          // Store in database
          const isNew = await storeOpportunity(opportunity);
          if (isNew) {
            result.newOpportunities++;
            newOpportunities.push(opportunity);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push(`Error fetching NAICS ${naicsCode}: ${errorMessage}`);
        logger.error("Error fetching opportunities for NAICS code", {
          naicsCode,
          error,
        });
      }
    }

    // Send notification if new opportunities found
    if (newOpportunities.length > 0 && config.notificationEmail) {
      await sendNotification(newOpportunities, config.notificationEmail);
    }

    // Update sync status
    await db
      .update(samGovSyncConfig)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: result.errors.length > 0 ? "partial" : "success",
        lastSyncError: result.errors.length > 0 ? result.errors.join("; ") : null,
        totalOpportunitiesFound: (config.totalOpportunitiesFound || 0) + result.newOpportunities,
        updatedAt: new Date(),
      })
      .where(eq(samGovSyncConfig.id, config.id));

    result.success = result.errors.length === 0;

    logger.info("SAM.gov opportunity sync completed", {
      newOpportunities: result.newOpportunities,
      totalFound: result.totalFound,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Sync failed: ${errorMessage}`);
    logger.error("SAM.gov opportunity sync failed", { error });
    return result;
  }
}

/**
 * Get recent opportunities from the database
 */
export async function getRecentOpportunities(
  limit: number = 50,
  status?: string
): Promise<typeof samGovOpportunities.$inferSelect[]> {
  const conditions = [];

  if (status) {
    conditions.push(eq(samGovOpportunities.status, status));
  }

  const query = conditions.length > 0
    ? db
        .select()
        .from(samGovOpportunities)
        .where(and(...conditions))
        .orderBy(desc(samGovOpportunities.postedDate))
        .limit(limit)
    : db
        .select()
        .from(samGovOpportunities)
        .orderBy(desc(samGovOpportunities.postedDate))
        .limit(limit);

  return query;
}

/**
 * Update opportunity status (reviewed, imported, dismissed)
 */
export async function updateOpportunityStatus(
  id: number,
  status: string,
  dismissedReason?: string
): Promise<void> {
  await db
    .update(samGovOpportunities)
    .set({
      status,
      dismissedReason: dismissedReason || null,
      updatedAt: new Date(),
    })
    .where(eq(samGovOpportunities.id, id));
}

// ============================================================================
// NSN Catalog Integration
// ============================================================================

/**
 * Get unique FSC codes from the NSN catalog
 * FSC (Federal Supply Class) maps to PSC (Product Service Code) for opportunity matching
 */
export async function getCatalogFscCodes(): Promise<string[]> {
  const result = await db
    .selectDistinct({ fsc: nsnCatalog.fsc })
    .from(nsnCatalog)
    .where(eq(nsnCatalog.active, true));

  return result.map(r => r.fsc);
}

/**
 * Get NSN catalog statistics
 */
export async function getNsnCatalogStats(): Promise<{
  totalNsns: number;
  byFsc: Record<string, number>;
}> {
  const allNsns = await db.select().from(nsnCatalog).where(eq(nsnCatalog.active, true));

  const byFsc: Record<string, number> = {};
  for (const nsn of allNsns) {
    byFsc[nsn.fsc] = (byFsc[nsn.fsc] || 0) + 1;
  }

  return {
    totalNsns: allNsns.length,
    byFsc,
  };
}

/**
 * Check if an NSN exists in the catalog
 */
export async function isNsnInCatalog(nsn: string): Promise<boolean> {
  const result = await db
    .select()
    .from(nsnCatalog)
    .where(eq(nsnCatalog.nsn, nsn))
    .limit(1);

  return result.length > 0;
}

/**
 * Get NSNs matching an FSC code
 */
export async function getNsnsByFsc(fsc: string): Promise<typeof nsnCatalog.$inferSelect[]> {
  return db.select().from(nsnCatalog).where(eq(nsnCatalog.fsc, fsc));
}
