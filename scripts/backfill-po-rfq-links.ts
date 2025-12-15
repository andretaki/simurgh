/**
 * Backfill Script: Link existing POs to their RFQs
 *
 * This script:
 * 1. Finds all governmentOrders without an rfqDocumentId
 * 2. For each, tries to find a matching rfqDocument by:
 *    a) Exact RFQ number match (if rfqNumber is already set)
 *    b) Re-extracting RFQ number from the PO's extractedData
 *    c) Matching by NSN + similar dates (fuzzy match)
 * 3. Updates the governmentOrder with the link
 *
 * Usage:
 *   npx tsx scripts/backfill-po-rfq-links.ts
 *   npx tsx scripts/backfill-po-rfq-links.ts --dry-run
 */

import { db } from "../lib/db";
import { governmentOrderRfqLinks, governmentOrders, rfqDocuments } from "../drizzle/migrations/schema";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { normalizeRfqNumber } from "../lib/rfq-number";

const isDryRun = process.argv.includes("--dry-run");

interface LinkResult {
  poId: number;
  poNumber: string;
  rfqDocumentId: number | null;
  rfqNumber: string | null;
  matchType: "exact" | "extracted" | "nsn_fuzzy" | "none";
}

function normalizeNsn(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length !== 13) return null;
  return digits;
}

function extractNsnsFromUnknown(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (value == null) return out;
  if (typeof value === "string") {
    const nsnCandidates = value.match(/\b\d{4}-\d{2}-\d{3}-\d{4}\b/g) || [];
    for (const nsn of nsnCandidates) {
      const normalized = normalizeNsn(nsn);
      if (normalized) out.add(normalized);
    }
    const digitCandidates = value.match(/\b\d{13}\b/g) || [];
    for (const nsn of digitCandidates) {
      const normalized = normalizeNsn(nsn);
      if (normalized) out.add(normalized);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractNsnsFromUnknown(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      extractNsnsFromUnknown(v, out);
    }
    return out;
  }
  return out;
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

async function findMatchingRfq(
  po: typeof governmentOrders.$inferSelect
): Promise<{ rfqDocumentId: number; rfqNumber: string; matchType: string } | null> {
  // 1. Try exact match by existing rfqNumber field
  const existingRfqNumber = normalizeRfqNumber(po.rfqNumber);
  if (existingRfqNumber) {
    const [match] = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.rfqNumber, existingRfqNumber))
      .limit(1);

    if (match) {
      return { rfqDocumentId: match.id, rfqNumber: existingRfqNumber, matchType: "exact" };
    }
  }

  // 2. Try to find RFQ number in extractedData
  const extractedData = po.extractedData as Record<string, unknown> | null;
  if (extractedData) {
    // Check various possible field names
    const possibleRfqNumber =
      extractedData.rfqNumber ||
      extractedData.rfq_number ||
      extractedData.solicitation_number ||
      extractedData.solicitationNumber ||
      extractedData.reference_number;

    const normalized = normalizeRfqNumber(possibleRfqNumber);
    if (normalized) {
      const [match] = await db
        .select()
        .from(rfqDocuments)
        .where(eq(rfqDocuments.rfqNumber, normalized))
        .limit(1);

      if (match) {
        return { rfqDocumentId: match.id, rfqNumber: normalized, matchType: "extracted" };
      }
    }
  }

  // 3. Try fuzzy match by NSN
  const poNsn = normalizeNsn(po.nsn);
  if (poNsn) {
    const conditions = [eq(rfqDocuments.status, "processed")];
    if (po.createdAt) {
      // Prefer RFQs close in time to the PO to avoid "match anything before PO" behavior.
      conditions.push(gte(rfqDocuments.createdAt, subtractDays(po.createdAt, 180)));
      conditions.push(lte(rfqDocuments.createdAt, po.createdAt));
    }

    const rfqCandidates = await db
      .select()
      .from(rfqDocuments)
      .where(and(...conditions))
      .orderBy(desc(rfqDocuments.createdAt))
      .limit(250);

    let best: { rfq: typeof rfqDocuments.$inferSelect; score: number } | null = null;
    for (const rfq of rfqCandidates) {
      const nsns = extractNsnsFromUnknown(rfq.extractedFields);
      const hasNsn = nsns.has(poNsn);
      if (!hasNsn) continue;

      let score = 50;
      const summary = (rfq.extractedFields as any)?.rfqSummary;
      const items: Array<any> = summary?.items || [];
      if (typeof po.quantity === "number" && items.some((it) => it?.quantity === po.quantity)) {
        score += 5;
      }
      if (rfq.rfqNumber) score += 1;

      if (!best || score > best.score) best = { rfq, score };
    }

    if (best && best.score >= 50) {
      return {
        rfqDocumentId: best.rfq.id,
        rfqNumber: best.rfq.rfqNumber || "unknown",
        matchType: "nsn_fuzzy",
      };
    }
  }

  return null;
}

async function backfillLinks(): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`PO → RFQ Backfill Script ${isDryRun ? "(DRY RUN)" : ""}`);
  console.log(`${"=".repeat(60)}\n`);

  // Find all POs without any junction-table link (legacy rfqDocumentId may still exist)
  const unlinkedPOs = await db
    .select({ po: governmentOrders })
    .from(governmentOrders)
    .leftJoin(
      governmentOrderRfqLinks,
      eq(governmentOrderRfqLinks.governmentOrderId, governmentOrders.id)
    )
    .where(isNull(governmentOrderRfqLinks.id))
    .orderBy(desc(governmentOrders.createdAt))
    .then(rows => rows.map(r => r.po));

  console.log(`Found ${unlinkedPOs.length} POs without RFQ links\n`);

  if (unlinkedPOs.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  const results: LinkResult[] = [];

  for (const po of unlinkedPOs) {
    process.stdout.write(`Processing PO ${po.poNumber}... `);

    const legacyLinkId = po.rfqDocumentId ?? null;
    const legacyRfqNumber = normalizeRfqNumber(po.rfqNumber);

    const match = legacyLinkId
      ? { rfqDocumentId: legacyLinkId, rfqNumber: legacyRfqNumber || "unknown", matchType: "exact" }
      : await findMatchingRfq(po);

    if (match) {
      console.log(`✓ Found RFQ ${match.rfqNumber} (${match.matchType})`);

      if (!isDryRun) {
        await db.transaction(async (tx) => {
          await tx.insert(governmentOrderRfqLinks).values({
            governmentOrderId: po.id,
            rfqDocumentId: match.rfqDocumentId,
          });

          // Keep legacy columns updated for backward compatibility (until fully removed)
          await tx
            .update(governmentOrders)
            .set({
              rfqNumber: match.rfqNumber,
              rfqDocumentId: match.rfqDocumentId,
              updatedAt: new Date(),
            })
            .where(eq(governmentOrders.id, po.id));
        });
      }

      results.push({
        poId: po.id,
        poNumber: po.poNumber,
        rfqDocumentId: match.rfqDocumentId,
        rfqNumber: match.rfqNumber,
        matchType: match.matchType as LinkResult["matchType"],
      });
    } else {
      console.log(`✗ No matching RFQ found`);
      results.push({
        poId: po.id,
        poNumber: po.poNumber,
        rfqDocumentId: null,
        rfqNumber: null,
        matchType: "none",
      });
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("Summary");
  console.log(`${"=".repeat(60)}\n`);

  const linked = results.filter((r) => r.rfqDocumentId !== null);
  const unlinked = results.filter((r) => r.rfqDocumentId === null);

  console.log(`Total POs processed: ${results.length}`);
  console.log(`Successfully linked:  ${linked.length}`);
  console.log(`  - Exact match:      ${results.filter((r) => r.matchType === "exact").length}`);
  console.log(`  - Extracted:        ${results.filter((r) => r.matchType === "extracted").length}`);
  console.log(`  - NSN fuzzy:        ${results.filter((r) => r.matchType === "nsn_fuzzy").length}`);
  console.log(`Could not link:       ${unlinked.length}`);

  if (unlinked.length > 0) {
    console.log(`\nUnlinked POs:`);
    for (const u of unlinked) {
      console.log(`  - PO ${u.poNumber} (ID: ${u.poId})`);
    }
  }

  if (isDryRun) {
    console.log(`\n⚠️  DRY RUN - No changes were made. Run without --dry-run to apply.`);
  } else {
    console.log(`\n✓ Done! ${linked.length} POs were linked to their RFQs.`);
  }
}

// Run the script
backfillLinks()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
