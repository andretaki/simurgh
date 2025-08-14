// utils/overlayPDFText.ts

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FormData, PriceBreak } from "../types/form";

type FieldType = "text" | "checkbox" | "radio" | "radioGroup";

interface FieldCoordinate {
  pageIndex: number;
  x: number;
  y: number;
  size?: number;
  type: FieldType;
  // For radio groups, each option has its own (x, y)
  options?: {
    [key: string]: {
      x: number;
      y: number;
    };
  };
}

/**
 * --------------------------------------------------------------
 * 1) Coordinate mapping for all fields in the PDF
 *
 * The mapping below is based on your JSON data:
 * - Fields originally on "page": 1 are now on pageIndex 0.
 * - Fields originally on "page": 2 are now on pageIndex 1.
 * - Fields originally on "page": 3 are now on pageIndex 2.
 *
 * Adjust the coordinates and pageIndex values as necessary.
 * --------------------------------------------------------------
 */
const COORDINATE_MAPPING: Partial<Record<keyof FormData, FieldCoordinate>> = {
  // ----- Page 1 (pageIndex: 0) -----
  // Special Instructions
  SpecInst7TextField1: {
    pageIndex: 0,
    x: 348.44,
    y: 493,
    size: 10,
    type: "text",
  },
  SpecInst8Checkbox1: {
    pageIndex: 0,
    x: 308.86,
    y: 432,
    type: "checkbox",
  },
  SpecInst8Checkbox2: {
    pageIndex: 0,
    x: 425.9,
    y: 432,
    type: "checkbox",
  },
  SpecInst8Checkbox3: {
    pageIndex: 0,
    x: 337.34,
    y: 420,
    type: "checkbox",
  },
  // Quote Details
  priceFirmUntil: {
    pageIndex: 0,
    x: 109.66,
    y: 338.4,
    size: 10,
    type: "text",
  },
  quoteRefNum: {
    pageIndex: 0,
    x: 264.78,
    y: 338.4,
    size: 10,
    type: "text",
  },
  // Payment Terms
  paymentTerms: {
    pageIndex: 0,
    x: 113.45,
    y: 320.9,
    type: "radioGroup",
    options: {
      Option1: { x: 113.45, y: 320.9 },
      Option2: { x: 288.66, y: 320.9 },
    },
  },
  paymentTermsOther: {
    pageIndex: 0,
    x: 339.85,
    y: 322.4,
    size: 10,
    type: "text",
  },
  // Shipping & Handling
  complimentaryFreight: {
    pageIndex: 0,
    x: 98.17,
    y: 304.9,
    type: "checkbox",
  },
  ppaByVender: {
    pageIndex: 0,
    x: 194.88,
    y: 304.9,
    type: "checkbox",
  },
  fob: {
    pageIndex: 0,
    x: 66.61,
    y: 288.9,
    type: "radioGroup",
    options: {
      Option1: { x: 66.61, y: 288.9 },
      Option2: { x: 116.1, y: 288.9 },
    },
  },
  purchaseOrderMinimum: {
    pageIndex: 0,
    x: 150.38,
    y: 274.4,
    size: 10,
    type: "text",
  },
  // Business Info
  SAMUEI: {
    pageIndex: 0,
    x: 80.42,
    y: 258.4,
    size: 10,
    type: "text",
  },
  CAGE: {
    pageIndex: 0,
    x: 239.2,
    y: 258.4,
    size: 10,
    type: "text",
  },
  SAM: {
    pageIndex: 0,
    x: 446.1,
    y: 256.9,
    type: "radioGroup",
    options: {
      Yes: { x: 446.1, y: 256.9 },
      No: { x: 482.1, y: 256.9 },
    },
  },
  NAICS: {
    pageIndex: 0,
    x: 93.19,
    y: 242.4,
    size: 10,
    type: "text",
  },
  NAICSSIZE: {
    pageIndex: 0,
    x: 535.82,
    y: 242.4,
    size: 10,
    type: "text",
  },
  BT: {
    pageIndex: 0,
    x: 102.24,
    y: 224.9,
    type: "radioGroup",
    options: {
      Option1: { x: 102.24, y: 224.9 },
      Option2: { x: 142.24, y: 224.9 },
    },
  },
  smalldisad: {
    pageIndex: 0,
    x: 46,
    y: 198.1,
    type: "checkbox",
  },
  HubZone: {
    pageIndex: 0,
    x: 287.09,
    y: 198.1,
    type: "checkbox",
  },
  womenowned: {
    pageIndex: 0,
    x: 46,
    y: 174.9,
    type: "checkbox",
  },
  vetowned: {
    pageIndex: 0,
    x: 287.46,
    y: 174.9,
    type: "checkbox",
  },
  sdvet: {
    pageIndex: 0,
    x: 46,
    y: 151.7,
    type: "checkbox",
  },
  hist: {
    pageIndex: 0,
    x: 287.5,
    y: 151.7,
    type: "checkbox",
  },
  ANC: {
    pageIndex: 0,
    x: 46,
    y: 128.5,
    type: "checkbox",
  },
  other: {
    pageIndex: 0,
    x: 288.01,
    y: 128.5,
    type: "checkbox",
  },
  size: {
    pageIndex: 0,
    x: 36,
    y: 94.5,
    type: "radioGroup",
    options: {
      Option1: { x: 36, y: 94.5 },
      Option2: { x: 77, y: 94.5 },
      Option3: { x: 132, y: 94.5 },
      Option4: { x: 192, y: 94.5 },
      Option5: { x: 260, y: 94.5 },
    },
  },
  // Add these new fields
  productDescription: {
    pageIndex: 0, // page 1
    x: 100,
    y: 650, // Adjust based on actual position in PDF
    size: 10,
    type: "text",
  },
  quantity: {
    pageIndex: 0, // page 1
    x: 100,
    y: 630, // Adjust based on actual position in PDF
    size: 10,
    type: "text",
  },
  unit: {
    pageIndex: 0, // page 1
    x: 200,
    y: 630, // Adjust based on actual position in PDF
    size: 10,
    type: "text",
  },
  unitPrice: {
    pageIndex: 0, // page 1
    x: 300,
    y: 630, // Adjust based on actual position in PDF
    size: 10,
    type: "text",
  },
  deliveryTimeline: {
    pageIndex: 0, // page 1
    x: 400,
    y: 630, // Adjust based on actual position in PDF
    size: 10,
    type: "text",
  },
  quoteValidity: {
    pageIndex: 0, // page 1
    x: 300,
    y: 400, // Adjust based on actual position in PDF
    size: 10,
    type: "text",
  },
  authorizedSignature: {
    pageIndex: 0, // page 1
    x: 100,
    y: 100, // Adjust based on actual position in PDF
    size: 10,
    type: "text",
  },
  signatureDate: {
    pageIndex: 0, // page 1
    x: 200,
    y: 100, // Adjust based on actual position in PDF
    size: 10,
    type: "text",
  },

  // ----- Page 2 (pageIndex: 1) -----
  // No Bid Fields
  noBidCode: {
    pageIndex: 1,
    x: 36,
    y: 736.5,
    type: "radioGroup",
    options: {
      Option1: { x: 36, y: 736.5 },
      Option2: { x: 204.42, y: 736.5 },
      Option3: { x: 36, y: 720.5 },
      Option4: { x: 193.42, y: 720.5 },
    },
  },
  noBidReason: {
    pageIndex: 1,
    x: 244.61,
    y: 722,
    size: 10,
    type: "text",
  },
  "noBidReason-1": {
    pageIndex: 1,
    x: 36,
    y: 505.5,
    type: "radioGroup",
    options: {
      Option1: { x: 36, y: 505.5 },
      Option2: { x: 125.5, y: 505.5 },
      Option3: { x: 293.82, y: 505.5 },
      Option4: { x: 36, y: 489.5 },
      Option5: { x: 136.29, y: 489.5 },
    },
  },
  "noBidOther-1": {
    pageIndex: 1,
    x: 173.51,
    y: 489,
    size: 12,
    type: "text",
  },

  // ----- Page 3 (pageIndex: 2) -----
  // Pricing / Product Details & Additional Fields
  "unitCost-1": {
    pageIndex: 2,
    x: 80.59,
    y: 554,
    size: 10,
    type: "text",
  },
  "deliveryDays-1": {
    pageIndex: 2,
    x: 246.55,
    y: 552,
    size: 12,
    type: "text",
  },
  "madeIn-1": {
    pageIndex: 2,
    x: 377.89,
    y: 552.5,
    type: "radioGroup",
    options: {
      Option1: { x: 377.89, y: 552.5 },
      Option2: { x: 426.31, y: 552.5 },
    },
  },
  "madeInOther-1": {
    pageIndex: 2,
    x: 472.98,
    y: 554,
    size: 10,
    type: "text",
  },
  "exceptionNote-1": {
    pageIndex: 2,
    x: 105.28,
    y: 538,
    size: 10,
    type: "text",
  },
  "polchemQuestion1-1": {
    pageIndex: 2,
    x: 292.11,
    y: 455,
    size: 12,
    type: "text",
  },
  "polchemQuestion2-1": {
    pageIndex: 2,
    x: 171.55,
    y: 439,
    size: 12,
    type: "text",
  },
  "polchemQuestion3-1": {
    pageIndex: 2,
    x: 130.98,
    y: 423,
    size: 12,
    type: "text",
  },
  S006TextField1: {
    pageIndex: 2,
    x: 125.05,
    y: 656,
    size: 10,
    type: "text",
  },
  // (Note: Your JSON includes S006TextField1 twice; here we assume one key.)
  S006TextField2: {
    pageIndex: 2,
    x: 564.94,
    y: 656,
    size: 10,
    type: "text",
  },
  S006TextField3: {
    pageIndex: 2,
    x: 211.91,
    y: 592,
    size: 10,
    type: "text",
  },
  S006TextField4: {
    pageIndex: 2,
    x: 238.54,
    y: 592,
    size: 10,
    type: "text",
  },
  S006TextField5: {
    pageIndex: 2,
    x: 141.05,
    y: 560,
    size: 10,
    type: "text",
  },
  S006TextField6: {
    pageIndex: 2,
    x: 167.68,
    y: 560,
    size: 10,
    type: "text",
  },
  S006TextField7: {
    pageIndex: 2,
    x: 474.3,
    y: 560,
    size: 10,
    type: "text",
  },
  S006TextField8: {
    pageIndex: 2,
    x: 500.93,
    y: 560,
    size: 10,
    type: "text",
  },
  S006TextField9: {
    pageIndex: 2,
    x: 72,
    y: 512,
    size: 10,
    type: "text",
  },
  S006TextField10: {
    pageIndex: 2,
    x: 72,
    y: 512,
    size: 10,
    type: "text",
  },
  S006TextField11: {
    pageIndex: 2,
    x: 72,
    y: 512,
    size: 10,
    type: "text",
  },
  S006TextField12: {
    pageIndex: 2,
    x: 72,
    y: 512,
    size: 10,
    type: "text",
  },
  S006TextField13: {
    pageIndex: 2,
    x: 97.65,
    y: 496,
    size: 10,
    type: "text",
  },
  // (If there is a second S006TextField13, adjust accordingly.)
};

/**
 * --------------------------------------------------------------
 * 2) PDFOverlayInstruction: defines what text to draw on the PDF
 * --------------------------------------------------------------
 */
export interface PDFOverlayInstruction {
  pageIndex: number;
  text: string;
  x: number;
  y: number;
  size?: number;
}

/**
 * --------------------------------------------------------------
 * 3) Generate instructions for the Price Breaks table
 * --------------------------------------------------------------
 */
function generatePriceBreakInstructions(
  priceBreaks: PriceBreak[],
): PDFOverlayInstruction[] {
  const instructions: PDFOverlayInstruction[] = [];
  const baseY = 500;
  const rowSpacing = 20;

  priceBreaks.forEach((pb, idx) => {
    const currentY = baseY - idx * rowSpacing;
    instructions.push({
      pageIndex: 0,
      text: pb.fromQty,
      x: 80,
      y: currentY,
      size: 12,
    });
    instructions.push({
      pageIndex: 0,
      text: pb.toQty,
      x: 160,
      y: currentY,
      size: 12,
    });
    instructions.push({
      pageIndex: 0,
      text: pb.unitCost,
      x: 240,
      y: currentY,
      size: 12,
    });
    instructions.push({
      pageIndex: 0,
      text: pb.delDays,
      x: 320,
      y: currentY,
      size: 12,
    });
  });

  return instructions;
}

/**
 * --------------------------------------------------------------
 * 4) Generate overlay instructions for all fields based on the form data
 * --------------------------------------------------------------
 */
function generateOverlayInstructions(
  formData: FormData,
): PDFOverlayInstruction[] {
  const instructions: PDFOverlayInstruction[] = [];

  (
    Object.entries(COORDINATE_MAPPING) as [keyof FormData, FieldCoordinate][]
  ).forEach(([fieldKey, coords]) => {
    const value = formData[fieldKey];
    if (!value) return; // Skip if no value

    switch (coords.type) {
      case "checkbox":
        if (value === "On") {
          instructions.push({
            pageIndex: coords.pageIndex,
            text: "X",
            x: coords.x,
            y: coords.y,
            size: coords.size,
          });
        }
        break;

      case "radioGroup":
        if (coords.options && coords.options[value as string]) {
          const option = coords.options[value as string];
          instructions.push({
            pageIndex: coords.pageIndex,
            text: "X",
            x: option.x,
            y: option.y,
            size: coords.size,
          });
        }
        break;

      case "text":
        instructions.push({
          pageIndex: coords.pageIndex,
          text: String(value),
          x: coords.x,
          y: coords.y,
          size: coords.size ?? 12,
        });
        break;
    }
  });

  // Also handle PriceBreaks separately.
  instructions.push(...generatePriceBreakInstructions(formData.priceBreaks));

  return instructions;
}

/**
 * --------------------------------------------------------------
 * 5) Public function to generate a PDF with text overlay
 * --------------------------------------------------------------
 */
export async function generatePDFWithOverlay(
  formData: FormData,
  templatePdfBytes: Uint8Array,
): Promise<Uint8Array> {
  console.log("Starting PDF generation");

  const pdfDoc = await PDFDocument.load(templatePdfBytes);
  const pages = pdfDoc.getPages();
  console.log(`PDF loaded, has ${pages.length} pages`);

  // Log page dimensions for debugging
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    console.log(`Page ${i}: ${width} x ${height}`);
  });

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const instructions = generateOverlayInstructions(formData);

  console.log(
    "Generated instructions:",
    instructions.map((i) => ({
      page: i.pageIndex,
      text: i.text,
      position: `(${i.x}, ${i.y})`,
    })),
  );

  instructions.forEach(({ pageIndex, text, x, y, size }) => {
    if (pageIndex >= pages.length) {
      console.error(
        `Skipping text "${text}" - page ${pageIndex} doesn't exist`,
      );
      return;
    }

    try {
      pages[pageIndex].drawText(text, {
        x,
        y,
        size: size ?? 12,
        font,
        color: rgb(0, 0, 0),
      });
      console.log(`Drew "${text}" on page ${pageIndex} at (${x}, ${y})`);
    } catch (error) {
      console.error(`Failed to draw "${text}" on page ${pageIndex}:`, error);
    }
  });

  console.log("PDF generation complete");
  return pdfDoc.save();
}
