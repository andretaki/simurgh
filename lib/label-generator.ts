import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { createCanvas } from "canvas";

interface LabelData {
  labelType: "box" | "bottle";
  labelSize: "4x6" | "3x4";
  productName: string;
  grade?: string;
  spec?: string;
  nsn?: string;
  nsnBarcode?: string;
  cageCode?: string;
  poNumber: string;
  lotNumber: string;
  quantity?: string;
  weight?: string;
  assemblyDate?: string;
  inspectionDate?: string;
  mhmDate?: string;
  containerType?: string;
  hazardSymbols?: string[];
  // Alliance Chemical defaults
  manufacturer?: string;
  manufacturerAddress?: string;
  manufacturerPhone?: string;
  manufacturerWebsite?: string;
}

// Convert barcode to base64 data URL
function generateBarcodeBase64(value: string, width = 2, height = 40): string {
  const canvas = createCanvas(200, 80);
  JsBarcode(canvas, value, {
    format: "CODE128",
    width,
    height,
    displayValue: false,
    margin: 0,
  });
  return canvas.toDataURL("image/png");
}

export function generateLabelPDF(data: LabelData): string {
  // Dimensions in inches (jsPDF uses pt by default, 72pt = 1 inch)
  const isBoxLabel = data.labelSize === "4x6";
  const width = isBoxLabel ? 6 : 4;
  const height = isBoxLabel ? 4 : 3;

  // Create PDF in landscape orientation for our label
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "in",
    format: [height, width],
  });

  // Set defaults
  const manufacturer = data.manufacturer || "ALLIANCE CHEMICAL";
  const manufacturerAddress =
    data.manufacturerAddress || "204 S. EDMOND ST. TAYLOR, TEXAS 76574";
  const manufacturerPhone = data.manufacturerPhone || "512-365-6838";
  const manufacturerWebsite =
    data.manufacturerWebsite || "www.alliancechemical.com";
  const cageCode = data.cageCode || "1LT50";

  // Colors
  const black = "#000000";
  const red = "#CC0000";

  // Margins
  const margin = 0.1;
  const contentWidth = width - margin * 2;

  // Font sizes (adjusted for label size)
  const titleSize = isBoxLabel ? 12 : 10;
  const normalSize = isBoxLabel ? 8 : 7;
  const smallSize = isBoxLabel ? 6 : 5;

  let y = margin + 0.1;

  // === HEADER - Product Name ===
  doc.setFontSize(titleSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(black);

  const productTitle = `${data.productName}${data.grade ? `, ${data.grade}` : ""}`;
  doc.text(productTitle, width / 2, y, { align: "center" });
  y += 0.2;

  // Container type
  if (data.containerType) {
    doc.setFontSize(normalSize);
    doc.setFont("helvetica", "normal");
    doc.text(data.containerType, width / 2, y, { align: "center" });
    y += 0.15;
  }

  // === SPEC LINE ===
  if (data.spec) {
    doc.setFontSize(smallSize);
    doc.text(`I/A/W ${data.spec}`, width / 2, y, { align: "center" });
    y += 0.2;
  }

  // === BARCODES ===
  // NSN Barcode
  if (data.nsnBarcode) {
    try {
      const nsnBarcode = generateBarcodeBase64(data.nsnBarcode, 2, 35);
      const barcodeWidth = isBoxLabel ? 2 : 1.5;
      const barcodeX = width / 2 - barcodeWidth / 2;
      doc.addImage(nsnBarcode, "PNG", barcodeX, y, barcodeWidth, 0.4);
      y += 0.45;

      // NSN text below barcode
      doc.setFontSize(normalSize);
      doc.text(data.nsnBarcode, width / 2, y, { align: "center" });
      y += 0.15;

      // Dashed NSN
      if (data.nsn) {
        doc.text(data.nsn, width / 2, y, { align: "center" });
        y += 0.2;
      }
    } catch (e) {
      console.error("Barcode generation error:", e);
    }
  }

  // CAGE Code barcode
  try {
    const cageBarcode = generateBarcodeBase64(cageCode, 2, 30);
    const cageBarcodeWidth = isBoxLabel ? 1.5 : 1;
    const cageX = width / 2 - cageBarcodeWidth / 2;
    doc.addImage(cageBarcode, "PNG", cageX, y, cageBarcodeWidth, 0.3);
    y += 0.35;
    doc.setFontSize(normalSize);
    doc.text(cageCode, width / 2, y, { align: "center" });
    y += 0.2;
  } catch (e) {
    console.error("CAGE barcode error:", e);
  }

  // === INFO GRID ===
  const leftCol = margin + 0.1;
  const rightCol = width / 2 + 0.1;
  const colWidth = width / 2 - margin - 0.15;

  doc.setFontSize(smallSize);
  doc.setFont("helvetica", "normal");

  // Left column - PO, Lot, Dates
  let leftY = y;
  doc.text(`P.O. #: ${data.poNumber}`, leftCol, leftY);
  leftY += 0.12;
  doc.text(`LOT #: ${data.lotNumber}`, leftCol, leftY);
  leftY += 0.12;
  if (data.mhmDate) {
    doc.text(`MHM: ${data.mhmDate}`, leftCol, leftY);
    leftY += 0.12;
  }

  // Right column - Quantity, Weight, Dates
  let rightY = y;
  if (data.quantity) {
    doc.text(`QTY: ${data.quantity}`, rightCol, rightY);
    rightY += 0.12;
  }
  if (data.weight) {
    doc.text(`WEIGHT: ${data.weight}`, rightCol, rightY);
    rightY += 0.12;
  }
  if (data.assemblyDate) {
    doc.text(`ASSEMBLED: ${data.assemblyDate}`, rightCol, rightY);
    rightY += 0.12;
  }
  if (data.inspectionDate) {
    doc.text(`INSP/TEST: ${data.inspectionDate}`, rightCol, rightY);
    rightY += 0.12;
  }

  y = Math.max(leftY, rightY) + 0.1;

  // === MANUFACTURER INFO ===
  doc.setFontSize(smallSize);
  doc.text(`MFR: ${manufacturer}`, width / 2, y, { align: "center" });
  y += 0.1;
  doc.text(manufacturerAddress, width / 2, y, { align: "center" });
  y += 0.1;
  doc.text(`Phone: ${manufacturerPhone}`, width / 2, y, { align: "center" });
  y += 0.1;
  doc.text(manufacturerWebsite, width / 2, y, { align: "center" });
  y += 0.15;

  // === HAZARD SECTION ===
  if (data.hazardSymbols && data.hazardSymbols.length > 0) {
    // Draw "DANGER" text in red
    doc.setFontSize(titleSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(red);
    doc.text("DANGER", width / 2, y, { align: "center" });
    doc.setTextColor(black);
    y += 0.2;

    // Note: Hazard symbol images would need to be embedded
    // For now, list them as text
    doc.setFontSize(smallSize);
    doc.setFont("helvetica", "normal");
    const hazardText = data.hazardSymbols
      .map((s) => {
        const names: Record<string, string> = {
          flamme: "FLAMMABLE",
          acid_red: "CORROSIVE",
          exclam: "IRRITANT",
          skull: "TOXIC",
          silhouete: "HEALTH HAZARD",
          rondflam: "OXIDIZER",
          aquatic: "ENVIRONMENTAL",
        };
        return names[s] || s;
      })
      .join(" | ");
    doc.text(hazardText, width / 2, y, { align: "center" });
  }

  // === BORDER ===
  doc.setDrawColor(0);
  doc.setLineWidth(0.02);
  doc.rect(margin, margin, width - margin * 2, height - margin * 2);

  // Return as base64
  return doc.output("datauristring").split(",")[1];
}

export function generateBoxLabelPDF(data: Omit<LabelData, "labelType" | "labelSize">): string {
  return generateLabelPDF({
    ...data,
    labelType: "box",
    labelSize: "4x6",
  });
}

export function generateBottleLabelPDF(data: Omit<LabelData, "labelType" | "labelSize">): string {
  return generateLabelPDF({
    ...data,
    labelType: "bottle",
    labelSize: "3x4",
  });
}
