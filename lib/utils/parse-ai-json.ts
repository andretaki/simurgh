/**
 * Robust JSON parsing for AI model responses
 *
 * AI models (Gemini, Claude, etc.) often return JSON wrapped in markdown code blocks
 * despite being asked not to. This utility handles various formats:
 * - ```json\n{...}\n```
 * - ```json {...}``` (with spaces)
 * - ```\n{...}\n``` (without json specifier)
 * - Raw JSON
 * - JSON with surrounding text
 */

export interface ParseAiJsonResult<T = unknown> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Parse JSON from AI response, stripping markdown code blocks if present
 * @param content - Raw AI response text
 * @returns Parsed JSON object
 * @throws Error if JSON parsing fails after cleanup
 */
export function parseAiJson<T = unknown>(content: string): T {
  let cleaned = content;

  // Strip markdown code blocks - handle various formats
  // Pattern handles: ```json, ```JSON, ``` (no specifier), with any whitespace
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/im, '')  // Start block with optional 'json' and whitespace
    .replace(/```\s*$/m, '')             // End block with optional whitespace
    .trim();

  // If still has backticks (nested or malformed), try more aggressive cleanup
  if (cleaned.includes('```')) {
    cleaned = cleaned
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
  }

  // Try to extract JSON object if wrapped in other text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return JSON.parse(cleaned) as T;
}

/**
 * Safe version that returns a result object instead of throwing
 * @param content - Raw AI response text
 * @returns Result object with success status and parsed data or error
 */
export function parseAiJsonSafe<T = unknown>(content: string): ParseAiJsonResult<T> {
  try {
    const data = parseAiJson<T>(content);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}
