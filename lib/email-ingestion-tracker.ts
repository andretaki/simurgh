import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

interface IngestionCheckpoint {
  lastSuccessfulRun: Date | null;
  lastAttemptedRun: Date | null;
  consecutiveFailures: number;
  lastProcessedEmailDate: Date | null;
  lastProcessedEmailId: string | null;
}

const CHECKPOINT_KEY = "email_ingestion_checkpoint";
const MAX_LOOKBACK_DAYS = 30; // Maximum days to look back
const DEFAULT_LOOKBACK_DAYS = 2; // Default when no checkpoint exists
const FAILURE_LOOKBACK_MULTIPLIER = 2; // Double lookback on each failure

/**
 * Get the last successful ingestion checkpoint from database or local storage
 */
export async function getIngestionCheckpoint(): Promise<IngestionCheckpoint> {
  try {
    // Try to get from database (using extractedFields JSON storage as a simple KV store)
    const result = await db.execute(sql`
      SELECT extracted_fields 
      FROM simurgh.rfq_documents 
      WHERE file_name = ${CHECKPOINT_KEY}
      AND status = 'checkpoint'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const rows = (result as any).rows || result;
    if (rows && rows.length > 0 && rows[0]?.extracted_fields) {
      const checkpoint = rows[0].extracted_fields as any;
      return {
        lastSuccessfulRun: checkpoint.lastSuccessfulRun ? new Date(checkpoint.lastSuccessfulRun) : null,
        lastAttemptedRun: checkpoint.lastAttemptedRun ? new Date(checkpoint.lastAttemptedRun) : null,
        consecutiveFailures: checkpoint.consecutiveFailures || 0,
        lastProcessedEmailDate: checkpoint.lastProcessedEmailDate ? new Date(checkpoint.lastProcessedEmailDate) : null,
        lastProcessedEmailId: checkpoint.lastProcessedEmailId || null,
      };
    }
  } catch (error) {
    console.error("Error retrieving checkpoint:", error);
  }

  // Return default checkpoint if none exists
  return {
    lastSuccessfulRun: null,
    lastAttemptedRun: null,
    consecutiveFailures: 0,
    lastProcessedEmailDate: null,
    lastProcessedEmailId: null,
  };
}

/**
 * Save the ingestion checkpoint after successful processing
 */
export async function saveIngestionCheckpoint(
  checkpoint: IngestionCheckpoint
): Promise<void> {
  try {
    // Store as a special document in rfq_documents table
    await db.execute(sql`
      INSERT INTO simurgh.rfq_documents (
        file_name,
        s3_key,
        status,
        extracted_fields,
        created_at,
        updated_at
      ) VALUES (
        ${CHECKPOINT_KEY},
        'checkpoint',
        'checkpoint',
        ${JSON.stringify({
          lastSuccessfulRun: checkpoint.lastSuccessfulRun?.toISOString(),
          lastAttemptedRun: checkpoint.lastAttemptedRun?.toISOString(),
          consecutiveFailures: checkpoint.consecutiveFailures,
          lastProcessedEmailDate: checkpoint.lastProcessedEmailDate?.toISOString(),
          lastProcessedEmailId: checkpoint.lastProcessedEmailId,
        })}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (file_name) 
      DO UPDATE SET
        extracted_fields = EXCLUDED.extracted_fields,
        updated_at = NOW()
    `);
  } catch (error) {
    console.error("Error saving checkpoint:", error);
    // Fallback: could use Redis/KV store if available
  }
}

/**
 * Calculate how far back to search based on checkpoint and failure count
 */
export function calculateLookbackDate(checkpoint: IngestionCheckpoint): {
  lookbackDate: Date;
  lookbackDays: number;
  reason: string;
} {
  const now = new Date();
  
  // Case 1: No checkpoint exists (first run)
  if (!checkpoint.lastSuccessfulRun) {
    const lookbackDate = new Date(now);
    lookbackDate.setDate(lookbackDate.getDate() - DEFAULT_LOOKBACK_DAYS);
    return {
      lookbackDate,
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
      reason: "No previous checkpoint - using default lookback"
    };
  }

  // Case 2: Recent successful run (normal operation)
  const hoursSinceLastRun = (now.getTime() - checkpoint.lastSuccessfulRun.getTime()) / (1000 * 60 * 60);
  
  if (checkpoint.consecutiveFailures === 0 && hoursSinceLastRun < 24) {
    // Look back from last successful run + small buffer
    const lookbackDate = new Date(checkpoint.lastSuccessfulRun);
    lookbackDate.setMinutes(lookbackDate.getMinutes() - 30); // 30 min buffer
    return {
      lookbackDate,
      lookbackDays: Math.ceil((now.getTime() - lookbackDate.getTime()) / (1000 * 60 * 60 * 24)),
      reason: "Normal operation - checking from last successful run"
    };
  }

  // Case 3: Failures detected - exponential backoff
  if (checkpoint.consecutiveFailures > 0) {
    const failureLookback = Math.min(
      DEFAULT_LOOKBACK_DAYS * Math.pow(FAILURE_LOOKBACK_MULTIPLIER, checkpoint.consecutiveFailures),
      MAX_LOOKBACK_DAYS
    );
    const lookbackDate = new Date(now);
    lookbackDate.setDate(lookbackDate.getDate() - failureLookback);
    return {
      lookbackDate,
      lookbackDays: failureLookback,
      reason: `Failure recovery - ${checkpoint.consecutiveFailures} consecutive failures`
    };
  }

  // Case 4: Long gap since last run (missed cron jobs)
  const daysSinceLastRun = hoursSinceLastRun / 24;
  const lookbackDays = Math.min(Math.ceil(daysSinceLastRun) + 1, MAX_LOOKBACK_DAYS);
  const lookbackDate = new Date(now);
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
  
  return {
    lookbackDate,
    lookbackDays,
    reason: `Gap detected - ${Math.floor(daysSinceLastRun)} days since last run`
  };
}

/**
 * Mark ingestion as failed and increment failure counter
 */
export async function markIngestionFailed(error: string): Promise<void> {
  const checkpoint = await getIngestionCheckpoint();
  checkpoint.lastAttemptedRun = new Date();
  checkpoint.consecutiveFailures++;
  
  console.error(`Ingestion failed (attempt ${checkpoint.consecutiveFailures}):`, error);
  
  await saveIngestionCheckpoint(checkpoint);
}

/**
 * Mark ingestion as successful and reset failure counter
 */
export async function markIngestionSuccess(
  lastProcessedEmailDate?: Date,
  lastProcessedEmailId?: string
): Promise<void> {
  const checkpoint = await getIngestionCheckpoint();
  
  checkpoint.lastSuccessfulRun = new Date();
  checkpoint.lastAttemptedRun = new Date();
  checkpoint.consecutiveFailures = 0;
  
  if (lastProcessedEmailDate) {
    checkpoint.lastProcessedEmailDate = lastProcessedEmailDate;
  }
  if (lastProcessedEmailId) {
    checkpoint.lastProcessedEmailId = lastProcessedEmailId;
  }
  
  await saveIngestionCheckpoint(checkpoint);
}

/**
 * Get ingestion status and health check
 */
export async function getIngestionHealth(): Promise<{
  healthy: boolean;
  lastRun: Date | null;
  consecutiveFailures: number;
  nextLookback: { lookbackDate: Date; lookbackDays: number; reason: string };
  alert: string | null;
}> {
  const checkpoint = await getIngestionCheckpoint();
  const lookback = calculateLookbackDate(checkpoint);
  
  const hoursSinceLastRun = checkpoint.lastSuccessfulRun
    ? (Date.now() - checkpoint.lastSuccessfulRun.getTime()) / (1000 * 60 * 60)
    : Infinity;

  let alert = null;
  if (checkpoint.consecutiveFailures >= 3) {
    alert = `CRITICAL: ${checkpoint.consecutiveFailures} consecutive failures`;
  } else if (hoursSinceLastRun > 24) {
    alert = `WARNING: No successful run in ${Math.floor(hoursSinceLastRun)} hours`;
  }

  return {
    healthy: checkpoint.consecutiveFailures < 3 && hoursSinceLastRun < 48,
    lastRun: checkpoint.lastSuccessfulRun,
    consecutiveFailures: checkpoint.consecutiveFailures,
    nextLookback: lookback,
    alert,
  };
}