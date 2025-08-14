// utils/cleanSummary.ts

export interface PriceBreakRange {
  fromQty: string;
  toQty: string;
}

/**
 * Extracts price break ranges from the summary text.
 */
export const extractPriceBreaks = (summary: string): PriceBreakRange[] => {
  // Look for the quantity breaks section
  const priceBreaksMatch = summary.match(
    /Quantity Price Breaks for item \d+([\s\S]*?)(?=\n\n|$)/,
  );

  if (!priceBreaksMatch) return [];

  const lines = priceBreaksMatch[1].split("\n");
  const priceBreaks: PriceBreakRange[] = [];

  for (const line of lines) {
    // Match lines that start with numbers for quantity ranges
    const match = line.trim().match(/^(\d+)\s+(\d+)/);
    if (match) {
      priceBreaks.push({
        fromQty: match[1],
        toQty: match[2],
      });
    }
  }

  return priceBreaks;
};

/**
 * Cleans the RFQ summary by removing specified sections.
 * @param summary The original RFQ summary.
 * @returns The cleaned summary and extracted price breaks.
 */
export const cleanSummary = (
  summary: string,
): {
  cleanedSummary: string;
  priceBreaks: PriceBreakRange[];
} => {
  // First extract price breaks before cleaning
  const priceBreaks = extractPriceBreaks(summary);

  // Define the sections to remove using regular expressions.
  const sectionsToRemove: RegExp[] = [
    /\*\*Company Information:\*\*[\s\S]*?(?=\n\n|$)/g,
    /\*\*Supplier Registration Requirements:\*\*[\s\S]*?(?=\n\n|$)/g,
    /\*\*Compliance and Certifications:\*\*[\s\S]*?(?=\n\n|$)/g,
    // Optionally remove the price breaks section after extraction
    /Quantity Price Breaks for item \d+[\s\S]*?(?=\n\n|$)/g,
  ];

  let cleanedSummary = summary;

  // Iterate over each regex pattern and remove matching sections.
  sectionsToRemove.forEach((regex) => {
    cleanedSummary = cleanedSummary.replace(regex, "");
  });

  // Remove any extra whitespace or newlines left after removal.
  cleanedSummary = cleanedSummary.replace(/^\s*\n/gm, "").trim();

  return {
    cleanedSummary,
    priceBreaks,
  };
};

// For backwards compatibility if some components still expect just the string
export const cleanSummaryText = (summary: string): string => {
  return cleanSummary(summary).cleanedSummary;
};
