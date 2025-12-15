/**
 * Branded Vendor Quote PDF Generator
 *
 * Generates a professional Alliance Chemical quote PDF using jsPDF.
 * Follows the same pattern as label-generator.ts for consistency.
 *
 * The generated PDF includes:
 * - Company logo and header
 * - Quote metadata (ref#, dates)
 * - Buyer/customer information
 * - Line items table with pricing
 * - Terms and compliance information
 */

import { jsPDF } from "jspdf";
import * as fs from "fs";
import * as path from "path";

// Types for the quote data
export interface VendorQuoteLineItem {
  lineNumber: string;
  nsn?: string | null;
  partNumber?: string | null;
  description: string;
  unitOfMeasure: string;
  quantity: number;
  unitPrice: number; // Numeric for calculations
  deliveryDays?: string;
  countryOfOrigin?: string;
  isIawNsn?: boolean;
  priceBreaks?: Array<{
    fromQty: number;
    toQty: number;
    unitPrice: number;
    deliveryDays?: string;
  }>;
}

export interface VendorQuoteData {
  // Quote identification
  vendorQuoteRef: string;
  quoteDate: string; // ISO date string
  quoteValidUntil: string; // ISO date string

  // RFQ reference
  rfqNumber: string;
  rfqDate?: string;

  // Buyer information
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  contractingOffice?: string;

  // Ship/Bill to
  shipToAddress?: string;
  billToAddress?: string;

  // Terms
  fob?: string;
  paymentTerms?: string;
  shippingTerms?: string;
  deliveryDays?: string; // Global delivery lead time

  // Company compliance info
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyWebsite?: string;
  cageCode?: string;
  samUei?: string;
  naicsCode?: string;
  certifications?: string[]; // e.g., ["SDB", "WOSB", "SAM Registered"]

  // Line items
  lineItems: VendorQuoteLineItem[];

  // Optional notes
  notes?: string;

  // Country of origin (global default)
  countryOfOrigin?: string;

  // Authorized signature
  authorizedSignature?: string;
}

/**
 * Format a number as USD currency: $1,234.56
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format date from ISO to MM/DD/YYYY
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  } catch {
    return isoDate;
  }
}

/**
 * Load logo from public directory and convert to base64
 * Falls back to text if logo cannot be loaded
 */
function loadLogoBase64(): string | null {
  try {
    // In Next.js, public files are served from the root
    // But in server-side code, we need to read from filesystem
    const logoPath = path.join(process.cwd(), "public", "alliance-logo.png");
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch (error) {
    console.warn("Could not load alliance logo:", error);
    return null;
  }
}

/**
 * Generate a branded vendor quote PDF
 * Returns the PDF as a Buffer
 */
export function generateVendorQuotePDF(data: VendorQuoteData): Buffer {
  // Create PDF - Letter size (8.5" x 11")
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt", // points (72 pt = 1 inch)
    format: "letter", // 612 x 792 pt
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryColor = "#CC0000"; // Alliance red
  const black = "#000000";
  const gray = "#666666";
  const lightGray = "#CCCCCC";

  let y = margin;

  // ========== HEADER WITH LOGO ==========
  const logoBase64 = loadLogoBase64();

  if (logoBase64) {
    // Add logo (approximately 150x50 aspect ratio based on the image)
    try {
      doc.addImage(logoBase64, "PNG", margin, y, 150, 50);
    } catch (e) {
      console.warn("Failed to add logo image:", e);
      // Fallback to text
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor);
      doc.text("ALLIANCE CHEMICAL", margin, y + 30);
    }
  } else {
    // Text fallback
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text("ALLIANCE CHEMICAL", margin, y + 30);
  }

  // Company contact info on right side
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray);
  const companyInfoX = pageWidth - margin;
  doc.text(data.companyName, companyInfoX, y + 10, { align: "right" });
  doc.text(data.companyAddress, companyInfoX, y + 20, { align: "right" });
  doc.text(data.companyPhone, companyInfoX, y + 30, { align: "right" });
  if (data.companyWebsite) {
    doc.text(data.companyWebsite, companyInfoX, y + 40, { align: "right" });
  }

  y += 60;

  // Divider line
  doc.setDrawColor(lightGray);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // ========== QUOTE TITLE ==========
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(black);
  doc.text("VENDOR QUOTATION", pageWidth / 2, y, { align: "center" });
  y += 25;

  // ========== QUOTE METADATA ==========
  const metaColWidth = contentWidth / 2;

  // Left column - Quote info
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(black);
  doc.text("Quote Reference:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.vendorQuoteRef, margin + 85, y);

  // Right column - Dates
  doc.setFont("helvetica", "bold");
  doc.text("Quote Date:", margin + metaColWidth, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.quoteDate), margin + metaColWidth + 65, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("RFQ Number:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.rfqNumber || "N/A", margin + 85, y);

  doc.setFont("helvetica", "bold");
  doc.text("Valid Until:", margin + metaColWidth, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.quoteValidUntil), margin + metaColWidth + 65, y);
  y += 20;

  // ========== BUYER INFORMATION ==========
  if (data.contractingOffice || data.buyerName || data.buyerEmail) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(black);
    doc.text("CUSTOMER INFORMATION", margin, y);
    y += 12;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray);

    if (data.contractingOffice) {
      doc.text(`Contracting Office: ${data.contractingOffice}`, margin, y);
      y += 11;
    }
    if (data.buyerName) {
      doc.text(`Contact: ${data.buyerName}`, margin, y);
      y += 11;
    }
    if (data.buyerEmail) {
      doc.text(`Email: ${data.buyerEmail}`, margin, y);
      y += 11;
    }
    if (data.buyerPhone) {
      doc.text(`Phone: ${data.buyerPhone}`, margin, y);
      y += 11;
    }
    y += 5;
  }

  // ========== SHIP TO / BILL TO ==========
  if (data.shipToAddress || data.billToAddress) {
    const hasShip = !!data.shipToAddress;
    const hasBill = !!data.billToAddress;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(black);

    if (hasShip) {
      doc.text("SHIP TO", margin, y);
    }
    if (hasBill) {
      doc.text("BILL TO", margin + metaColWidth, y);
    }
    y += 12;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray);

    if (hasShip && data.shipToAddress) {
      const shipLines = data.shipToAddress.split("\n").slice(0, 4);
      shipLines.forEach((line) => {
        doc.text(line, margin, y);
        y += 10;
      });
    }
    // Reset y if we need to handle bill to separately
    y += 5;
  }

  // ========== TERMS & COMPLIANCE ==========
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(black);
  doc.text("TERMS & COMPLIANCE", margin, y);
  y += 14;

  doc.setFontSize(8);
  const termsCol1X = margin;
  const termsCol2X = margin + 180;
  const termsCol3X = margin + 360;

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.text("FOB:", termsCol1X, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.fob || "Origin", termsCol1X + 30, y);

  doc.setFont("helvetica", "bold");
  doc.text("Payment:", termsCol2X, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.paymentTerms || "Net 30", termsCol2X + 50, y);

  doc.setFont("helvetica", "bold");
  doc.text("Lead Time:", termsCol3X, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.deliveryDays ? `${data.deliveryDays} days` : "Per line item", termsCol3X + 55, y);
  y += 12;

  // Row 2 - Compliance
  doc.setFont("helvetica", "bold");
  doc.text("CAGE:", termsCol1X, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.cageCode || "N/A", termsCol1X + 35, y);

  doc.setFont("helvetica", "bold");
  doc.text("SAM UEI:", termsCol2X, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.samUei || "N/A", termsCol2X + 50, y);

  doc.setFont("helvetica", "bold");
  doc.text("NAICS:", termsCol3X, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.naicsCode || "N/A", termsCol3X + 40, y);
  y += 12;

  // Row 3 - Country of Origin
  doc.setFont("helvetica", "bold");
  doc.text("Country of Origin:", termsCol1X, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.countryOfOrigin || "USA", termsCol1X + 90, y);

  // Certifications
  if (data.certifications && data.certifications.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Certifications:", termsCol2X, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.certifications.join(", "), termsCol2X + 70, y);
  }
  y += 20;

  // ========== LINE ITEMS TABLE ==========
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(black);
  doc.text("LINE ITEMS", margin, y);
  y += 15;

  // Table header
  const tableX = margin;
  const colWidths = {
    line: 30,
    nsn: 85,
    description: 150,
    uom: 35,
    qty: 40,
    unitPrice: 65,
    extended: 65,
  };

  // Draw header background
  doc.setFillColor(240, 240, 240);
  doc.rect(tableX, y - 10, contentWidth, 14, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  let colX = tableX + 3;
  doc.text("Line", colX, y);
  colX += colWidths.line;
  doc.text("NSN / Part#", colX, y);
  colX += colWidths.nsn;
  doc.text("Description", colX, y);
  colX += colWidths.description;
  doc.text("UOM", colX, y);
  colX += colWidths.uom;
  doc.text("Qty", colX, y);
  colX += colWidths.qty;
  doc.text("Unit Price", colX, y);
  colX += colWidths.unitPrice;
  doc.text("Extended", colX, y);
  y += 8;

  // Draw header bottom line
  doc.setDrawColor(lightGray);
  doc.setLineWidth(0.5);
  doc.line(tableX, y, tableX + contentWidth, y);
  y += 8;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  let subtotal = 0;

  for (const item of data.lineItems) {
    // Check if we need a new page
    if (y > pageHeight - 120) {
      doc.addPage();
      y = margin;
    }

    const extendedPrice = item.unitPrice * item.quantity;
    subtotal += extendedPrice;

    colX = tableX + 3;
    doc.text(item.lineNumber, colX, y);
    colX += colWidths.line;

    // NSN or Part Number
    const nsnText = item.nsn || item.partNumber || "-";
    doc.text(nsnText.substring(0, 15), colX, y);
    colX += colWidths.nsn;

    // Description (truncate if too long)
    const descText = item.description.substring(0, 35);
    doc.text(descText, colX, y);
    colX += colWidths.description;

    doc.text(item.unitOfMeasure || "EA", colX, y);
    colX += colWidths.uom;

    doc.text(String(item.quantity), colX, y);
    colX += colWidths.qty;

    doc.text(formatCurrency(item.unitPrice), colX, y);
    colX += colWidths.unitPrice;

    doc.text(formatCurrency(extendedPrice), colX, y);
    y += 10;

    // Add IAW and delivery info if present
    let sublineInfo: string[] = [];
    if (item.isIawNsn) {
      sublineInfo.push("IAW NSN: Yes");
    }
    if (item.deliveryDays) {
      sublineInfo.push(`Delivery: ${item.deliveryDays} days`);
    }
    if (item.countryOfOrigin && item.countryOfOrigin !== data.countryOfOrigin) {
      sublineInfo.push(`Origin: ${item.countryOfOrigin}`);
    }

    if (sublineInfo.length > 0) {
      doc.setTextColor(gray);
      doc.setFontSize(6);
      doc.text(sublineInfo.join(" | "), tableX + colWidths.line + 3, y);
      doc.setTextColor(black);
      doc.setFontSize(7);
      y += 8;
    }

    // Price breaks if present
    if (item.priceBreaks && item.priceBreaks.length > 0) {
      doc.setFontSize(6);
      doc.setTextColor(gray);
      doc.text("Quantity Breaks:", tableX + colWidths.line + 3, y);
      y += 8;

      for (const pb of item.priceBreaks) {
        const pbText = `${pb.fromQty}-${pb.toQty}: ${formatCurrency(pb.unitPrice)}/ea${pb.deliveryDays ? ` (${pb.deliveryDays} days)` : ""}`;
        doc.text(pbText, tableX + colWidths.line + 10, y);
        y += 7;
      }
      doc.setTextColor(black);
      doc.setFontSize(7);
      y += 3;
    }

    // Draw row separator
    doc.setDrawColor(240, 240, 240);
    doc.line(tableX, y - 3, tableX + contentWidth, y - 3);
  }

  y += 10;

  // ========== TOTALS ==========
  // Draw totals box
  const totalsX = pageWidth - margin - 150;
  doc.setDrawColor(lightGray);
  doc.setLineWidth(0.5);
  doc.rect(totalsX, y - 5, 150, 30);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("SUBTOTAL:", totalsX + 10, y + 8);
  doc.text(formatCurrency(subtotal), totalsX + 140, y + 8, { align: "right" });

  doc.text("TOTAL:", totalsX + 10, y + 20);
  doc.setFontSize(10);
  doc.text(formatCurrency(subtotal), totalsX + 140, y + 20, { align: "right" });
  y += 45;

  // ========== NOTES ==========
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(black);
    doc.text("NOTES / EXCEPTIONS:", margin, y);
    y += 12;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(gray);

    // Wrap notes text
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    noteLines.slice(0, 5).forEach((line: string) => {
      doc.text(line, margin, y);
      y += 10;
    });
    y += 10;
  }

  // ========== SIGNATURE LINE ==========
  if (y < pageHeight - 80) {
    y = pageHeight - 80;
  } else {
    doc.addPage();
    y = margin + 20;
  }

  doc.setDrawColor(black);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 200, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(black);
  doc.text("Authorized Signature", margin, y + 12);

  if (data.authorizedSignature) {
    doc.setFont("helvetica", "italic");
    doc.text(data.authorizedSignature, margin, y - 5);
  }

  doc.line(margin + 250, y, margin + 400, y);
  doc.setFont("helvetica", "normal");
  doc.text("Date", margin + 250, y + 12);
  doc.text(formatDate(data.quoteDate), margin + 250, y - 5);

  // ========== FOOTER ==========
  const footerY = pageHeight - 25;
  doc.setFontSize(7);
  doc.setTextColor(gray);
  doc.text(
    `${data.companyName} | ${data.companyPhone} | ${data.companyWebsite || ""}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );
  doc.text(
    `Quote Reference: ${data.vendorQuoteRef}`,
    pageWidth / 2,
    footerY + 10,
    { align: "center" }
  );

  // Return as Buffer
  const pdfOutput = doc.output("arraybuffer");
  return Buffer.from(pdfOutput);
}

/**
 * Generate a vendor quote reference number
 * Format: ACQ-RFQ-{rfqNumber}-{seq}
 *
 * @param rfqNumber - The RFQ number from the document
 * @param existingCount - How many quotes already exist for this RFQ
 */
export function generateVendorQuoteRef(rfqNumber: string, existingCount: number): string {
  // Clean the RFQ number (remove special chars except hyphens)
  const cleanRfqNum = rfqNumber.replace(/[^a-zA-Z0-9-]/g, "");
  const seq = existingCount + 1;
  return `ACQ-RFQ-${cleanRfqNum}-${seq}`;
}
