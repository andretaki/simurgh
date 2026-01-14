/**
 * NSN Catalog Import API
 * POST /api/nsn-catalog/import - Bulk import NSNs
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nsnCatalog } from "@/drizzle/migrations/schema";
import { apiSuccess, apiError } from "@/lib/api-response";
import { sql } from "drizzle-orm";

// Parse NSN from various formats:
// - 6810-00-286-5435 (standard)
// - 6810002865435 (no dashes)
// - 6810 00 286 5435 (spaces)
function parseNsn(raw: string): { nsn: string; fsc: string; niin: string } | null {
  // Remove all whitespace and normalize
  const cleaned = raw.trim().toUpperCase();

  // Skip obviously invalid entries
  if (cleaned.length < 13) return null;
  if (!/\d/.test(cleaned)) return null;

  // Try to extract 13 digits (4-2-3-4 pattern)
  // Pattern: FSC(4) + NIIN(9) = 13 digits
  const digitsOnly = cleaned.replace(/[^0-9]/g, "");

  // Standard NSN format check
  const standardMatch = cleaned.match(/^(\d{4})-?(\d{2})-?(\d{3})-?(\d{4})$/);
  if (standardMatch) {
    const fsc = standardMatch[1];
    const niin = `${standardMatch[2]}${standardMatch[3]}${standardMatch[4]}`;
    const nsn = `${fsc}-${standardMatch[2]}-${standardMatch[3]}-${standardMatch[4]}`;
    return { nsn, fsc, niin };
  }

  // Try 13 consecutive digits
  if (digitsOnly.length >= 13) {
    const first13 = digitsOnly.slice(0, 13);
    const fsc = first13.slice(0, 4);
    const g2 = first13.slice(4, 6);
    const g3 = first13.slice(6, 9);
    const g4 = first13.slice(9, 13);
    const niin = `${g2}${g3}${g4}`;
    const nsn = `${fsc}-${g2}-${g3}-${g4}`;
    return { nsn, fsc, niin };
  }

  return null;
}

// Split input text into individual NSN candidates
function splitInput(text: string): string[] {
  // Split by newlines, commas, tabs, or multiple spaces
  return text
    .split(/[\n\r,\t]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, nsns: nsnArray } = body as { text?: string; nsns?: string[] };

    // Accept either raw text or array of NSNs
    let rawNsns: string[];
    if (text) {
      rawNsns = splitInput(text);
    } else if (nsnArray && Array.isArray(nsnArray)) {
      rawNsns = nsnArray;
    } else {
      return apiError("Request must include 'text' or 'nsns' field", 400);
    }

    if (rawNsns.length === 0) {
      return apiError("No NSNs provided", 400);
    }

    // Parse all NSNs
    const parsed: { nsn: string; fsc: string; niin: string }[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const raw of rawNsns) {
      const result = parseNsn(raw);
      if (result) {
        // Dedupe within this batch
        if (!seen.has(result.nsn)) {
          seen.add(result.nsn);
          parsed.push(result);
        }
      } else if (raw.length > 3) {
        // Only log errors for non-empty entries that look like they might be NSNs
        errors.push(raw.slice(0, 30));
      }
    }

    if (parsed.length === 0) {
      return apiError(`No valid NSNs found. Errors: ${errors.slice(0, 5).join(", ")}`, 400);
    }

    // Upsert all NSNs
    let imported = 0;
    let updated = 0;

    for (const item of parsed) {
      const result = await db
        .insert(nsnCatalog)
        .values({
          nsn: item.nsn,
          fsc: item.fsc,
          niin: item.niin,
          active: true,
        })
        .onConflictDoUpdate({
          target: nsnCatalog.nsn,
          set: {
            active: true,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: nsnCatalog.id });

      if (result.length > 0) {
        imported++;
      }
    }

    // Calculate stats by FSC
    const fscCounts: Record<string, number> = {};
    for (const item of parsed) {
      fscCounts[item.fsc] = (fscCounts[item.fsc] || 0) + 1;
    }

    return apiSuccess({
      imported,
      total: rawNsns.length,
      duplicatesInBatch: rawNsns.length - parsed.length - errors.length,
      parseErrors: errors.length,
      byFsc: fscCounts,
      sampleErrors: errors.slice(0, 10),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("NSN import error:", error);
    return apiError(`Failed to import NSNs: ${message}`, 500);
  }
}
