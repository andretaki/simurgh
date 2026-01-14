/**
 * Opportunity Sync API
 * GET/POST /api/opportunities/sync - Sync opportunities from SAM.gov
 *
 * Strategy:
 * 1. Get FSC codes from our NSN catalog (dynamic, not hardcoded)
 * 2. Search SAM.gov by FSC codes, NAICS codes, and product keywords
 * 3. Match ALL opportunities against our full NSN catalog
 * 4. Score and store with match reasons
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { samGovOpportunities, nsnCatalog } from "@/drizzle/migrations/schema";
import { eq, sql } from "drizzle-orm";
import { getSamGovClient, SamGovClient } from "@/lib/sam-gov/client";
import { apiSuccess, apiError } from "@/lib/api-response";

// NAICS codes relevant to chemicals/industrial products
const RELEVANT_NAICS = ['424690', '325998', '324191', '325199', '325180'];

// Product keywords to search
const PRODUCT_KEYWORDS = [
  { keyword: 'chemical', fsc: '6810' },
  { keyword: 'solvent', fsc: '6810' },
  { keyword: 'acid', fsc: '6810' },
  { keyword: 'reagent', fsc: '6810' },
  { keyword: 'alcohol', fsc: '6810' },
  { keyword: 'grease', fsc: '9150' },
  { keyword: 'lubricant', fsc: '9150' },
  { keyword: 'oil lubricating', fsc: '9150' },
];

// FSC code names for display
const FSC_NAMES: Record<string, string> = {
  '6810': 'Chemicals',
  '9150': 'Oils & Greases',
  '6850': 'Chemical Specialties',
  '8010': 'Paints/Varnishes',
  '9160': 'Misc Wax/Oils',
};

interface CatalogData {
  nsns: string[];
  fscCodes: string[];
  nsnSet: Set<string>;
  nsnNoDashSet: Set<string>;
}

// Load NSN catalog and extract unique FSC codes
async function loadCatalogData(): Promise<CatalogData> {
  const catalog = await db.select({
    nsn: nsnCatalog.nsn,
    fsc: nsnCatalog.fsc
  }).from(nsnCatalog);

  const nsns = catalog.map(c => c.nsn);
  const fscCodes = [...new Set(catalog.map(c => c.fsc))];

  // Pre-compute sets for fast matching
  const nsnSet = new Set(nsns);
  const nsnNoDashSet = new Set(nsns.map(n => n.replace(/-/g, '')));

  return { nsns, fscCodes, nsnSet, nsnNoDashSet };
}

// Find NSNs from our catalog that appear in text
function findMatchingNsns(text: string, catalog: CatalogData): string[] {
  if (!text) return [];

  const matches: string[] = [];
  const textUpper = text.toUpperCase();
  const textNormalized = textUpper.replace(/[^A-Z0-9]/g, ' ');

  for (const nsn of catalog.nsns) {
    // Standard format: 6810-00-286-5435
    if (textUpper.includes(nsn)) {
      matches.push(nsn);
      continue;
    }

    // No dashes: 6810002865435
    const nsnNoDash = nsn.replace(/-/g, '');
    if (textUpper.includes(nsnNoDash)) {
      matches.push(nsn);
      continue;
    }

    // Space separated: 6810 00 286 5435
    const nsnSpaces = nsn.replace(/-/g, ' ');
    if (textNormalized.includes(nsnSpaces)) {
      matches.push(nsn);
    }
  }

  return [...new Set(matches)];
}

// Extract FSC code from text (look for 4-digit patterns that match our catalog)
function findMatchingFsc(text: string, catalogFscs: string[]): string | null {
  if (!text) return null;

  for (const fsc of catalogFscs) {
    // Look for FSC code in various contexts
    if (text.includes(`FSC ${fsc}`) ||
        text.includes(`FSC: ${fsc}`) ||
        text.includes(`FSC-${fsc}`) ||
        text.includes(`${fsc}-`)) {
      return fsc;
    }
  }

  return null;
}

// Calculate relevance score
function calculateRelevance(
  opp: any,
  matchedNsns: string[],
  matchedFsc: string | null,
  matchedKeyword: string | null
): number {
  let score = 0;

  // TIER 1: NSN match - highest priority
  if (matchedNsns.length > 0) {
    score += 70;
    // Bonus for multiple NSN matches (up to 20 extra points)
    score += Math.min(matchedNsns.length * 5, 20);
  }

  // TIER 2: FSC match
  if (matchedFsc && Object.keys(FSC_NAMES).includes(matchedFsc)) {
    score += 25;
  }

  // TIER 3: Keyword match in title
  if (matchedKeyword) {
    const titleLower = opp.title?.toLowerCase() || '';
    if (titleLower.includes(matchedKeyword.toLowerCase())) {
      score += 10;
    }
  }

  // TIER 4: NAICS code match
  if (RELEVANT_NAICS.includes(opp.naicsCode)) {
    score += 5;
  }

  // TIER 5: Set-aside bonus (prefer small business opportunities)
  if (opp.setAsideType && opp.setAsideType !== 'None' && opp.setAsideType !== 'NONE') {
    score += 3;
  }

  return Math.min(score, 100);
}

function parseQuantityFromTitle(title: string): string | null {
  const match = title.match(/(\d+)\s*(GL|GAL|GALLON|EA|EACH|LB|CS|CASE|BX|BOX|DR|DRUM|PT|QT|OZ|KG|L|ML)/i);
  if (match) {
    return `${match[1]} ${match[2].toUpperCase()}`;
  }
  return null;
}

function parseLineItemsFromText(text: string): any[] {
  const items: any[] = [];
  if (!text) return items;

  // Pattern 1: NSN with quantity
  const nsnQtyPattern = /NSN[:\s]*(\d{4}-\d{2}-\d{3}-\d{4})[^]*?(?:QTY|Quantity)[:\s]*(\d+)\s*(\w+)?/gi;
  let match;
  while ((match = nsnQtyPattern.exec(text)) !== null) {
    items.push({
      lineNumber: String(items.length + 1),
      description: "",
      quantity: parseInt(match[2]),
      unit: match[3] || "EA",
      nsn: match[1],
    });
  }

  // Pattern 2: Simple quantity
  if (items.length === 0) {
    const simpleQtyPattern = /(\d+)\s*(GL|GAL|GALLON|EA|EACH|LB|CS|CASE|BX|BOX|DR|DRUM|PT|QT|OZ|KG|L|ML)/i;
    const simpleMatch = text.match(simpleQtyPattern);
    if (simpleMatch) {
      items.push({
        lineNumber: "1",
        description: text.substring(0, 100),
        quantity: parseInt(simpleMatch[1]),
        unit: simpleMatch[2].toUpperCase(),
        nsn: "",
      });
    }
  }

  return items;
}

async function fetchDescription(descUrl: string, apiKey: string): Promise<string | null> {
  if (!descUrl || !descUrl.startsWith("https://")) return null;

  try {
    const url = new URL(descUrl);
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString());
    if (response.ok) {
      const data = await response.json();
      return data.description || null;
    }
  } catch (err) {
    console.error("Failed to fetch description:", err);
  }
  return null;
}

// Delay helper
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function syncOpportunities() {
  const client = getSamGovClient();
  const dateRange = SamGovClient.getDateRange(30);
  const apiKey = process.env.SAM_GOV_API_KEY || "";

  // Load our NSN catalog
  const catalog = await loadCatalogData();
  console.log(`[SYNC] Loaded ${catalog.nsns.length} NSNs from catalog, FSC codes: ${catalog.fscCodes.join(', ')}`);

  if (catalog.nsns.length === 0) {
    console.log(`[SYNC] No NSNs in catalog - skipping NSN-based search`);
  }

  const allOpportunities = new Map<string, any>();

  // 1. Search by FSC codes from our catalog
  const fscCodesToSearch = catalog.fscCodes.length > 0
    ? catalog.fscCodes
    : ['6810', '9150', '6850']; // Fallback if catalog empty

  for (const fsc of fscCodesToSearch) {
    try {
      // Search for FSC code in title (e.g., "6810-00-" pattern)
      const result = await client.searchOpportunities({
        postedFrom: dateRange.from,
        postedTo: dateRange.to,
        keywords: fsc,
        ptype: 'o',
        limit: 50,
      });

      console.log(`[SYNC] FSC ${fsc}: Found ${result.opportunities.length} opportunities`);

      for (const opp of result.opportunities) {
        if (!allOpportunities.has(opp.solicitationNumber)) {
          allOpportunities.set(opp.solicitationNumber, {
            ...opp,
            matchSource: `FSC:${fsc}`,
            matchedFsc: fsc,
          });
        }
      }

      await delay(200);
    } catch (err) {
      console.error(`Error searching FSC ${fsc}:`, err);
    }
  }

  // 2. Search by product keywords
  for (const { keyword, fsc } of PRODUCT_KEYWORDS) {
    try {
      const result = await client.searchOpportunities({
        postedFrom: dateRange.from,
        postedTo: dateRange.to,
        keywords: keyword,
        ptype: 'o',
        limit: 30,
      });

      console.log(`[SYNC] Keyword "${keyword}": Found ${result.opportunities.length} opportunities`);

      for (const opp of result.opportunities) {
        if (!allOpportunities.has(opp.solicitationNumber)) {
          allOpportunities.set(opp.solicitationNumber, {
            ...opp,
            matchSource: `Keyword:${keyword}`,
            matchedFsc: fsc,
            matchedKeyword: keyword,
          });
        }
      }

      await delay(200);
    } catch (err) {
      console.error(`Error searching keyword "${keyword}":`, err);
    }
  }

  // 3. Search by NAICS codes
  for (const naics of RELEVANT_NAICS) {
    try {
      const result = await client.searchOpportunities({
        postedFrom: dateRange.from,
        postedTo: dateRange.to,
        naicsCodes: [naics],
        ptype: 'o',
        limit: 30,
      });

      console.log(`[SYNC] NAICS ${naics}: Found ${result.opportunities.length} opportunities`);

      for (const opp of result.opportunities) {
        if (!allOpportunities.has(opp.solicitationNumber)) {
          allOpportunities.set(opp.solicitationNumber, {
            ...opp,
            matchSource: `NAICS:${naics}`,
            matchedFsc: null,
          });
        }
      }

      await delay(200);
    } catch (err) {
      console.error(`Error searching NAICS ${naics}:`, err);
    }
  }

  console.log(`[SYNC] Total unique opportunities found: ${allOpportunities.size}`);

  // 4. Process and save opportunities
  let saved = 0;
  let updated = 0;
  let nsnMatches = 0;

  for (const opp of allOpportunities.values()) {
    try {
      const quantity = parseQuantityFromTitle(opp.title);

      // Check if exists
      const existing = await db.select()
        .from(samGovOpportunities)
        .where(eq(samGovOpportunities.solicitationNumber, opp.solicitationNumber))
        .limit(1);

      let fullDescription: string | null = null;
      let lineItems: any[] = [];
      let matchedNsns: string[] = [];
      let matchedFsc = opp.matchedFsc;
      let matchedKeyword = opp.matchedKeyword || null;

      if (existing.length > 0) {
        // Use existing description for matching
        const existingDesc = existing[0].fullDescription || existing[0].description || '';
        const textToMatch = `${existingDesc} ${opp.title} ${opp.description || ''}`;

        matchedNsns = findMatchingNsns(textToMatch, catalog);
        if (!matchedFsc) {
          matchedFsc = findMatchingFsc(textToMatch, catalog.fscCodes);
        }

        const relevance = calculateRelevance(opp, matchedNsns, matchedFsc, matchedKeyword);

        // Format match source for display
        let displayMatchSource = opp.matchSource;
        if (matchedNsns.length > 0) {
          displayMatchSource = `NSN:${matchedNsns[0]}`;
        }

        await db.update(samGovOpportunities)
          .set({
            relevanceScore: relevance,
            matchedKeyword: displayMatchSource,
            matchedFsc: matchedFsc,
            matchedNsns: matchedNsns.length > 0 ? matchedNsns : null,
            quantity: quantity || existing[0].quantity,
            updatedAt: new Date(),
          })
          .where(eq(samGovOpportunities.id, existing[0].id));

        updated++;
        if (matchedNsns.length > 0) nsnMatches++;
      } else {
        // New opportunity - fetch full description
        if (opp.description && opp.description.startsWith("https://")) {
          fullDescription = await fetchDescription(opp.description, apiKey);
          if (fullDescription) {
            lineItems = parseLineItemsFromText(fullDescription);
          }
          await delay(200);
        }

        // Match NSNs against all text
        const textToMatch = `${fullDescription || ''} ${opp.title} ${opp.description || ''}`;
        matchedNsns = findMatchingNsns(textToMatch, catalog);
        if (!matchedFsc) {
          matchedFsc = findMatchingFsc(textToMatch, catalog.fscCodes);
        }

        const relevance = calculateRelevance(opp, matchedNsns, matchedFsc, matchedKeyword);

        // Format match source for display
        let displayMatchSource = opp.matchSource;
        if (matchedNsns.length > 0) {
          displayMatchSource = `NSN:${matchedNsns[0]}`;
        }

        const poc = opp.pointOfContact?.[0];
        await db.insert(samGovOpportunities).values({
          solicitationNumber: opp.solicitationNumber,
          title: opp.title,
          agency: opp.agency || null,
          office: opp.office || null,
          postedDate: opp.postedDate ? new Date(opp.postedDate) : null,
          responseDeadline: opp.responseDeadline ? new Date(opp.responseDeadline) : null,
          naicsCode: opp.naicsCode || null,
          setAsideType: opp.setAsideType || null,
          description: opp.description || null,
          fullDescription: fullDescription,
          quantity: quantity,
          lineItems: lineItems.length > 0 ? lineItems : null,
          uiLink: opp.uiLink || null,
          attachments: opp.attachments || [],
          pocName: poc?.name || null,
          pocEmail: poc?.email || null,
          pocPhone: poc?.phone || null,
          rawData: opp.rawData || {},
          relevanceScore: relevance,
          matchedKeyword: displayMatchSource,
          matchedFsc: matchedFsc,
          matchedNsns: matchedNsns.length > 0 ? matchedNsns : null,
          status: 'new',
        });

        saved++;
        if (matchedNsns.length > 0) nsnMatches++;
      }
    } catch (err) {
      console.error(`Error saving ${opp.solicitationNumber}:`, err);
    }
  }

  const result = {
    synced: allOpportunities.size,
    saved,
    updated,
    nsnMatches,
    catalogSize: catalog.nsns.length,
    fscCodes: catalog.fscCodes,
  };

  console.log(`[SYNC] Complete:`, result);
  return result;
}

// GET - Called by Vercel cron
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return apiError("Unauthorized", 401);
      }
    }

    const result = await syncOpportunities();
    return apiSuccess(result);
  } catch (error) {
    console.error("[CRON] Sync error:", error);
    return apiError("Failed to sync opportunities", 500);
  }
}

// POST - Called by manual trigger from UI
export async function POST(request: NextRequest) {
  try {
    const result = await syncOpportunities();
    return apiSuccess(result);
  } catch (error) {
    console.error("Sync error:", error);
    return apiError("Failed to sync opportunities", 500);
  }
}
