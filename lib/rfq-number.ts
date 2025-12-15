export function normalizeRfqNumber(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (!value) return null;

  // Strip common surrounding punctuation
  value = value.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9]+$/, "");
  if (!value) return null;

  const upper = value.toUpperCase().replace(/\s+/g, " ");
  if (upper === "N/A" || upper === "NA" || upper === "NONE" || upper === "UNKNOWN" || upper === "NULL") {
    return null;
  }

  // RFQ/solicitation identifiers vary a lot (e.g. SPE8EJ-25-T-1234, 821-45659232).
  // Keep validation permissive but prevent obviously-bad values.
  if (upper.length < 3 || upper.length > 100) return null;
  if (!/[0-9]/.test(upper)) return null;
  if (!/^[A-Z0-9][A-Z0-9\-_/\. ]*[A-Z0-9]$/.test(upper)) return null;

  return upper;
}

