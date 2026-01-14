/**
 * SAM.gov API Client
 *
 * Provides access to:
 * - Get Opportunities API (contract opportunities/solicitations)
 * - Contract Awards API (historical award data)
 *
 * @see https://open.gsa.gov/api/get-opportunities-public-api/
 * @see https://open.gsa.gov/api/contract-awards/
 */

import { withRetry } from "@/lib/retry";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface OpportunitySearchParams {
  postedFrom: string; // MM/dd/yyyy format
  postedTo: string; // MM/dd/yyyy format
  naicsCodes?: string[]; // e.g., ['424690', '325998']
  keywords?: string; // Search in title
  ptype?: string; // Procurement type: o=solicitation, p=presolicitation, etc.
  limit?: number; // Max 1000
  offset?: number;
}

export interface Opportunity {
  solicitationNumber: string;
  title: string;
  postedDate: string;
  responseDeadline: string;
  naicsCode: string;
  setAsideType: string | null;
  agency: string;
  office: string;
  description: string;
  uiLink: string;
  attachments: OpportunityAttachment[];
  pointOfContact: PointOfContact[];
  award: OpportunityAward | null;
  rawData: Record<string, unknown>;
}

export interface OpportunityAttachment {
  name: string;
  url: string;
  type: string;
}

export interface PointOfContact {
  name: string;
  email: string;
  phone: string;
  type: string;
}

export interface OpportunityAward {
  amount: number;
  awardee: string;
  awardDate: string;
}

export interface OpportunityLineItem {
  lineNumber: string;
  description: string;
  quantity: number | null;
  unit: string;
  nsn: string;
  partNumber: string;
}

export interface OpportunityDetails {
  noticeId: string;
  solicitationNumber: string;
  title: string;
  description: string;
  fullDescription: string;

  // Dates
  postedDate: string;
  responseDeadline: string;
  archiveDate: string;

  // Classification
  naicsCode: string;
  psc: string;
  setAsideType: string | null;
  contractType: string;

  // Agency
  agency: string;
  office: string;
  location: string | null;

  // Contacts
  contacts: PointOfContact[];

  // Attachments
  attachments: (OpportunityAttachment & { size: number | null })[];

  // Line items
  lineItems: OpportunityLineItem[];

  // Award
  award: OpportunityAward | null;

  // Links
  uiLink: string;

  // Raw data
  rawData: Record<string, unknown>;
}

export interface OpportunitySearchResponse {
  totalRecords: number;
  opportunities: Opportunity[];
  limit: number;
  offset: number;
}

export interface AwardSearchParams {
  signedDateFrom: string; // MM/DD/YYYY format
  signedDateTo: string;
  productOrServiceCodes?: string[]; // PSC codes, max 100
  naicsCode?: string;
  limit?: number; // Default 10
  offset?: number;
}

export interface ContractAward {
  contractNumber: string;
  awardDate: string;
  totalValue: number;
  actionObligation: number;
  productServiceCode: string;
  naicsCode: string;
  awardeeUei: string;
  awardeeName: string;
  awardeeCage: string;
  contractingAgency: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  rawData: Record<string, unknown>;
}

export interface AwardSearchResponse {
  totalRecords: number;
  awards: ContractAward[];
  limit: number;
  offset: number;
}

// ============================================================================
// API Client
// ============================================================================

export class SamGovClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const apiKey = process.env.SAM_GOV_API_KEY;
    if (!apiKey) {
      throw new Error("SAM_GOV_API_KEY environment variable is not set");
    }
    this.apiKey = apiKey;
    this.baseUrl =
      process.env.SAM_GOV_BASE_URL || "https://api.sam.gov";
  }

  // --------------------------------------------------------------------------
  // Opportunities API
  // --------------------------------------------------------------------------

  /**
   * Search for contract opportunities
   */
  async searchOpportunities(
    params: OpportunitySearchParams
  ): Promise<OpportunitySearchResponse> {
    return withRetry(
      async () => {
        const url = this.buildOpportunitiesUrl(params);
        logger.info("Fetching SAM.gov opportunities", { url: url.toString().replace(this.apiKey, "***") });

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `SAM.gov Opportunities API error: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();
        return this.parseOpportunitiesResponse(data);
      },
      {
        maxAttempts: 3,
        delay: 2000,
        backoff: "exponential",
        onRetry: (attempt, error) => {
          logger.warn("Retrying SAM.gov opportunities request", {
            attempt,
            error: error.message,
          });
        },
        shouldRetry: (error) => {
          // Retry on network errors and 5xx errors, not on 4xx
          return !error.message.includes("4");
        },
      }
    );
  }

  private buildOpportunitiesUrl(params: OpportunitySearchParams): URL {
    const url = new URL(`${this.baseUrl}/opportunities/v2/search`);

    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("postedFrom", params.postedFrom);
    url.searchParams.set("postedTo", params.postedTo);
    url.searchParams.set("limit", String(params.limit || 100));
    url.searchParams.set("offset", String(params.offset || 0));

    if (params.naicsCodes && params.naicsCodes.length > 0) {
      // API accepts single NAICS code per request
      url.searchParams.set("ncode", params.naicsCodes[0]);
    }

    if (params.keywords) {
      url.searchParams.set("title", params.keywords);
    }

    if (params.ptype) {
      url.searchParams.set("ptype", params.ptype);
    }

    return url;
  }

  private parseOpportunitiesResponse(
    data: Record<string, unknown>
  ): OpportunitySearchResponse {
    const opportunitiesData = data.opportunitiesData as Array<Record<string, unknown>> || [];

    const opportunities: Opportunity[] = opportunitiesData.map((opp) => {
      const award = opp.award as Record<string, unknown> | null;
      const attachments = (opp.resourceLinks as Array<Record<string, unknown>> || []);
      const contacts = (opp.pointOfContact as Array<Record<string, unknown>> || []);

      return {
        solicitationNumber: String(opp.solicitationNumber || ""),
        title: String(opp.title || ""),
        postedDate: String(opp.postedDate || ""),
        responseDeadline: String(opp.responseDeadLine || opp.archiveDate || ""),
        naicsCode: String(opp.naicsCode || ""),
        setAsideType: opp.typeOfSetAside ? String(opp.typeOfSetAside) : null,
        agency: String(opp.department || ""),
        office: String(opp.subtier || opp.office || ""),
        description: String(opp.description || ""),
        uiLink: String(opp.uiLink || ""),
        attachments: attachments.map((att) => ({
          name: String(att.title || att.name || ""),
          url: String(att.href || att.url || ""),
          type: String(att.mimetype || "application/octet-stream"),
        })),
        pointOfContact: contacts.map((poc) => ({
          name: String(poc.fullName || ""),
          email: String(poc.email || ""),
          phone: String(poc.phone || ""),
          type: String(poc.type || "primary"),
        })),
        award: award
          ? {
              amount: Number(award.amount || 0),
              awardee: String((award.awardee as Record<string, unknown>)?.name || award.awardee || ""),
              awardDate: String(award.date || ""),
            }
          : null,
        rawData: opp,
      };
    });

    return {
      totalRecords: Number(data.totalRecords || opportunities.length),
      opportunities,
      limit: Number(data.limit || 100),
      offset: Number(data.offset || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Contract Awards API
  // --------------------------------------------------------------------------

  /**
   * Search for historical contract awards
   */
  async searchAwards(params: AwardSearchParams): Promise<AwardSearchResponse> {
    return withRetry(
      async () => {
        const url = this.buildAwardsUrl(params);
        logger.info("Fetching SAM.gov contract awards", { url: url.toString().replace(this.apiKey, "***") });

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `SAM.gov Awards API error: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();
        return this.parseAwardsResponse(data);
      },
      {
        maxAttempts: 3,
        delay: 2000,
        backoff: "exponential",
        onRetry: (attempt, error) => {
          logger.warn("Retrying SAM.gov awards request", {
            attempt,
            error: error.message,
          });
        },
        shouldRetry: (error) => {
          return !error.message.includes("4");
        },
      }
    );
  }

  private buildAwardsUrl(params: AwardSearchParams): URL {
    const url = new URL(`${this.baseUrl}/contract-awards/v1/search`);

    url.searchParams.set("api_key", this.apiKey);
    // Awards API uses date range format: [MM/DD/YYYY,MM/DD/YYYY]
    url.searchParams.set(
      "signedDate",
      `[${params.signedDateFrom},${params.signedDateTo}]`
    );
    url.searchParams.set("limit", String(params.limit || 25));
    url.searchParams.set("offset", String(params.offset || 0));

    if (params.productOrServiceCodes && params.productOrServiceCodes.length > 0) {
      // Join with tilde (~) for multiple PSC codes
      url.searchParams.set(
        "productOrServiceCode",
        params.productOrServiceCodes.slice(0, 100).join("~")
      );
    }

    if (params.naicsCode) {
      url.searchParams.set("naicsCode", params.naicsCode);
    }

    return url;
  }

  private parseAwardsResponse(data: Record<string, unknown>): AwardSearchResponse {
    const awardsData = data.data as Array<Record<string, unknown>> || [];

    const awards: ContractAward[] = awardsData.map((award) => {
      const awardDetails = award.awardDetails as Record<string, unknown> || {};
      const dollars = awardDetails.dollars as Record<string, unknown> || {};
      const awardee = award.awardee as Record<string, unknown> || {};
      const product = award.productOrService as Record<string, unknown> || {};

      // Try to extract unit price from the data
      // This may vary by contract type
      const totalValue = Number(dollars.baseAndAllOptionsValue || dollars.totalActionObligation || 0);
      const actionObligation = Number(dollars.actionObligation || 0);

      return {
        contractNumber: String(award.piid || award.contractNumber || ""),
        awardDate: String(awardDetails.dateSigned || award.dateSigned || ""),
        totalValue,
        actionObligation,
        productServiceCode: String(product.code || product.productOrServiceCode || ""),
        naicsCode: String(award.naicsCode || ""),
        awardeeUei: String(awardee.uei || awardee.ueiSAM || ""),
        awardeeName: String(awardee.name || awardee.vendorName || ""),
        awardeeCage: String(awardee.cageCode || ""),
        contractingAgency: String(award.contractingAgency || award.fundingAgency || ""),
        description: String(product.description || award.descriptionOfContractRequirement || ""),
        quantity: award.quantity ? Number(award.quantity) : null,
        unitPrice: award.unitPrice ? Number(award.unitPrice) : null,
        rawData: award,
      };
    });

    return {
      totalRecords: Number(data.totalRecords || awards.length),
      awards,
      limit: Number(data.limit || 25),
      offset: Number(data.offset || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Get Full Opportunity Details
  // --------------------------------------------------------------------------

  /**
   * Get full details for a specific opportunity including line items
   */
  async getOpportunityDetails(noticeId: string): Promise<OpportunityDetails | null> {
    return withRetry(
      async () => {
        const url = new URL(`${this.baseUrl}/opportunities/v2/search`);
        url.searchParams.set("api_key", this.apiKey);
        url.searchParams.set("noticeid", noticeId);
        url.searchParams.set("limit", "1");

        logger.info("Fetching SAM.gov opportunity details", { noticeId });

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SAM.gov API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const opps = data.opportunitiesData as Array<Record<string, unknown>> || [];

        if (opps.length === 0) return null;

        const opp = opps[0];

        // Fetch full description if it's a URL
        const descriptionUrl = opp.description as string;
        if (descriptionUrl && descriptionUrl.startsWith("https://")) {
          try {
            const descUrl = new URL(descriptionUrl);
            descUrl.searchParams.set("api_key", this.apiKey);
            const descResponse = await fetch(descUrl.toString());
            if (descResponse.ok) {
              const descData = await descResponse.json();
              if (descData.description) {
                opp.fullDescription = descData.description;
              }
            }
          } catch (err) {
            logger.warn("Failed to fetch notice description", { error: String(err) });
          }
        }

        return this.parseOpportunityDetails(opp);
      },
      {
        maxAttempts: 3,
        delay: 2000,
        backoff: "exponential",
        onRetry: (attempt, error) => {
          logger.warn("Retrying SAM.gov details request", { attempt, error: error.message });
        },
        shouldRetry: (error) => !error.message.includes("4"),
      }
    );
  }

  private parseOpportunityDetails(opp: Record<string, unknown>): OpportunityDetails {
    const attachments = (opp.resourceLinks as Array<Record<string, unknown>> || []);
    const contacts = (opp.pointOfContact as Array<Record<string, unknown>> || []);
    const lineItems = (opp.lineItems as Array<Record<string, unknown>> || []);
    const award = opp.award as Record<string, unknown> | null;

    // Extract place of performance
    const placeOfPerformance = opp.placeOfPerformance as Record<string, unknown> | null;

    // Parse line items from description if present (DLA format)
    const fullDesc = String(opp.fullDescription || "");
    const parsedLineItems = this.parseLineItemsFromDescription(fullDesc);

    return {
      noticeId: String(opp.noticeId || ""),
      solicitationNumber: String(opp.solicitationNumber || ""),
      title: String(opp.title || ""),
      description: fullDesc || String(opp.description || ""),
      fullDescription: fullDesc,

      // Dates
      postedDate: String(opp.postedDate || ""),
      responseDeadline: String(opp.responseDeadLine || opp.archiveDate || ""),
      archiveDate: String(opp.archiveDate || ""),

      // Classification
      naicsCode: String(opp.naicsCode || ""),
      psc: String(opp.classificationCode || opp.productOrServiceCode || ""),
      setAsideType: opp.typeOfSetAside ? String(opp.typeOfSetAside) : null,
      contractType: String(opp.typeOfContract || ""),

      // Agency
      agency: String(opp.department || ""),
      office: String(opp.subtier || opp.office || ""),
      location: placeOfPerformance ? String(placeOfPerformance.city || "") + ", " + String(placeOfPerformance.state || "") : null,

      // Contacts
      contacts: contacts.map((poc) => ({
        name: String(poc.fullName || ""),
        email: String(poc.email || ""),
        phone: String(poc.phone || ""),
        type: String(poc.type || "primary"),
      })),

      // Attachments
      attachments: attachments.map((att) => ({
        name: String(att.title || att.name || ""),
        url: String(att.href || att.url || ""),
        type: String(att.mimetype || "application/octet-stream"),
        size: att.size ? Number(att.size) : null,
      })),

      // Line items (from API or parsed from description)
      lineItems: lineItems.length > 0
        ? lineItems.map((item) => ({
            lineNumber: String(item.lineNumber || item.itemNumber || ""),
            description: String(item.description || item.title || ""),
            quantity: item.quantity ? Number(item.quantity) : null,
            unit: String(item.unitOfMeasure || item.unit || ""),
            nsn: String(item.nsn || item.nationalStockNumber || ""),
            partNumber: String(item.partNumber || item.manufacturerPartNumber || ""),
          }))
        : parsedLineItems,

      // Award info
      award: award ? {
        amount: Number(award.amount || 0),
        awardee: String((award.awardee as Record<string, unknown>)?.name || award.awardee || ""),
        awardDate: String(award.date || ""),
      } : null,

      // Links
      uiLink: String(opp.uiLink || ""),

      // Raw data
      rawData: opp,
    };
  }

  /**
   * Try to parse line items from description text
   * DLA and other agencies often embed item details in the description
   */
  private parseLineItemsFromDescription(description: string): OpportunityLineItem[] {
    const items: OpportunityLineItem[] = [];
    if (!description) return items;

    // Pattern 1: NSN with quantity (e.g., "NSN: 6810-00-286-5435, Qty: 100 EA")
    const nsnQtyPattern = /NSN[:\s]*(\d{4}-\d{2}-\d{3}-\d{4})[^]*?(?:QTY|Quantity)[:\s]*(\d+)\s*(\w+)?/gi;
    let match;
    while ((match = nsnQtyPattern.exec(description)) !== null) {
      items.push({
        lineNumber: String(items.length + 1),
        description: "",
        quantity: parseInt(match[2]),
        unit: match[3] || "EA",
        nsn: match[1],
        partNumber: "",
      });
    }

    // Pattern 2: Line item format (e.g., "0001 - Chemical compound, 50 GAL")
    const lineItemPattern = /(?:^|\n)\s*(\d{4})\s*[-–]\s*([^,\n]+),?\s*(\d+)\s*(\w+)?/gm;
    while ((match = lineItemPattern.exec(description)) !== null) {
      // Skip if we already have items from NSN pattern
      if (items.length === 0) {
        items.push({
          lineNumber: match[1],
          description: match[2].trim(),
          quantity: parseInt(match[3]),
          unit: match[4] || "EA",
          nsn: "",
          partNumber: "",
        });
      }
    }

    // Pattern 3: Simple quantity in title/description (e.g., "GREASE, 5GL" or "100 EACH")
    if (items.length === 0) {
      const simpleQtyPattern = /(\d+)\s*(GL|GAL|GALLON|EA|EACH|LB|CS|CASE|BX|BOX|DR|DRUM|PT|QT|OZ|KG|L|ML)/i;
      const simpleMatch = description.match(simpleQtyPattern);
      if (simpleMatch) {
        items.push({
          lineNumber: "1",
          description: description.substring(0, 100),
          quantity: parseInt(simpleMatch[1]),
          unit: simpleMatch[2].toUpperCase(),
          nsn: "",
          partNumber: "",
        });
      }
    }

    return items;
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Format date for Opportunities API (MM/dd/yyyy)
   */
  static formatOpportunityDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  /**
   * Format date for Awards API (MM/DD/YYYY)
   */
  static formatAwardDate(date: Date): string {
    return this.formatOpportunityDate(date);
  }

  /**
   * Get date range for the last N days
   */
  static getDateRange(days: number): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    return {
      from: this.formatOpportunityDate(from),
      to: this.formatOpportunityDate(to),
    };
  }

  /**
   * Extract PSC (Product Service Code) from NSN
   * NSN format: XXXX-XX-XXX-XXXX (first 4 digits are Federal Supply Class)
   * PSC is related but not identical - we use FSC as a starting point
   */
  static nsnToFsc(nsn: string): string {
    // Remove dashes and get first 4 characters
    const cleaned = nsn.replace(/-/g, "");
    return cleaned.substring(0, 4);
  }

  /**
   * Check if the API key is configured
   */
  static isConfigured(): boolean {
    return !!process.env.SAM_GOV_API_KEY;
  }
}

// Singleton instance
let samGovClient: SamGovClient | null = null;

export function getSamGovClient(): SamGovClient {
  if (!samGovClient) {
    samGovClient = new SamGovClient();
  }
  return samGovClient;
}
