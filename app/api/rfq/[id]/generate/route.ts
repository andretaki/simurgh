import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses, companyProfiles } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { uploadToS3, getPresignedDownloadUrl } from "@/lib/aws/s3";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rfqId = parseInt(params.id);
    const { responseData } = await request.json();

    if (isNaN(rfqId)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID" },
        { status: 400 }
      );
    }

    // Get RFQ document
    const [rfqDoc] = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, rfqId))
      .limit(1);

    if (!rfqDoc) {
      return NextResponse.json(
        { error: "RFQ not found" },
        { status: 404 }
      );
    }

    // Get company profile if exists
    const profiles = await db.select().from(companyProfiles).limit(1);
    const profile = profiles[0] || null;

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Add a page
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    const margin = 50;
    let yPosition = height - margin;

    // Header
    page.drawText('RFQ RESPONSE', {
      x: margin,
      y: yPosition,
      size: 20,
      font: helveticaBoldFont,
      color: rgb(0.1, 0.2, 0.6),
    });
    yPosition -= 30;

    // RFQ Information
    page.drawText(`RFQ Number: ${rfqDoc.rfqNumber || 'N/A'}`, {
      x: margin,
      y: yPosition,
      size: 12,
      font: timesRomanFont,
    });
    yPosition -= 20;

    page.drawText(`Response Date: ${new Date().toLocaleDateString()}`, {
      x: margin,
      y: yPosition,
      size: 12,
      font: timesRomanFont,
    });
    yPosition -= 20;

    if (rfqDoc.dueDate) {
      page.drawText(`Due Date: ${new Date(rfqDoc.dueDate).toLocaleDateString()}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: timesRomanFont,
      });
      yPosition -= 20;
    }

    // Line separator
    yPosition -= 10;
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: width - margin, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    yPosition -= 30;

    // Company Information Section
    page.drawText('VENDOR INFORMATION', {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0.1, 0.2, 0.6),
    });
    yPosition -= 25;

    // Company details
    const companyInfo = [
      ['Company Name:', responseData.companyName || ''],
      ['CAGE Code:', responseData.cageCode || ''],
      ['DUNS Number:', responseData.dunsNumber || ''],
      ['Address:', responseData.address || ''],
      ['Point of Contact:', responseData.pocName || ''],
      ['Email:', responseData.pocEmail || ''],
      ['Phone:', responseData.pocPhone || ''],
    ];

    for (const [label, value] of companyInfo) {
      page.drawText(label, {
        x: margin,
        y: yPosition,
        size: 11,
        font: helveticaBoldFont,
      });
      page.drawText(value, {
        x: margin + 120,
        y: yPosition,
        size: 11,
        font: timesRomanFont,
      });
      yPosition -= 18;
    }

    // Line separator
    yPosition -= 10;
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: width - margin, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    yPosition -= 30;

    // Response Details Section
    page.drawText('RESPONSE DETAILS', {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0.1, 0.2, 0.6),
    });
    yPosition -= 25;

    const responseDetails = [];
    
    if (responseData.unitCost) {
      responseDetails.push(['Unit Cost:', responseData.unitCost]);
    }
    if (responseData.deliveryTime) {
      responseDetails.push(['Delivery Time:', responseData.deliveryTime]);
    }
    if (responseData.paymentTerms) {
      responseDetails.push(['Payment Terms:', responseData.paymentTerms]);
    }
    if (responseData.shippingTerms) {
      responseDetails.push(['Shipping Terms:', responseData.shippingTerms]);
    }

    for (const [label, value] of responseDetails) {
      page.drawText(label, {
        x: margin,
        y: yPosition,
        size: 11,
        font: helveticaBoldFont,
      });
      page.drawText(value, {
        x: margin + 120,
        y: yPosition,
        size: 11,
        font: timesRomanFont,
      });
      yPosition -= 18;
    }

    // Technical Capabilities
    if (responseData.technicalCapabilities) {
      yPosition -= 10;
      page.drawText('Technical Capabilities:', {
        x: margin,
        y: yPosition,
        size: 11,
        font: helveticaBoldFont,
      });
      yPosition -= 18;

      // Wrap text for capabilities
      const capabilitiesLines = wrapText(responseData.technicalCapabilities, 80);
      for (const line of capabilitiesLines) {
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: 10,
          font: timesRomanFont,
        });
        yPosition -= 15;
        
        // Check if we need a new page
        if (yPosition < margin + 100) {
          const newPage = pdfDoc.addPage([612, 792]);
          yPosition = height - margin;
        }
      }
    }

    // Certifications Section (if profile exists)
    if (profile) {
      yPosition -= 20;
      page.drawText('CERTIFICATIONS', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBoldFont,
        color: rgb(0.1, 0.2, 0.6),
      });
      yPosition -= 20;

      const certifications = [];
      if (profile.smallBusiness) certifications.push('Small Business');
      if (profile.womanOwned) certifications.push('Woman-Owned Business');
      if (profile.veteranOwned) certifications.push('Veteran-Owned Business');
      if (profile.hubZone) certifications.push('HUBZone Certified');
      if (profile.eightA) certifications.push('8(a) Certified');

      if (certifications.length > 0) {
        page.drawText(certifications.join(', '), {
          x: margin,
          y: yPosition,
          size: 10,
          font: timesRomanFont,
        });
        yPosition -= 20;
      }
    }

    // Footer
    const footerY = 50;
    page.drawText('Generated by Simurgh RFQ Handler', {
      x: width / 2 - 80,
      y: footerY,
      size: 8,
      font: timesRomanFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Serialize the PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Upload to S3
    const timestamp = Date.now();
    const s3Key = `responses/${rfqId}-${timestamp}-response.pdf`;
    const { url } = await uploadToS3(s3Key, pdfBuffer, 'application/pdf');

    // Save response record
    const [savedResponse] = await db.insert(rfqResponses).values({
      rfqDocumentId: rfqId,
      companyProfileId: profile?.id || null,
      responseData,
      generatedPdfS3Key: s3Key,
      generatedPdfUrl: url,
      status: 'completed',
      submittedAt: new Date(),
    }).returning();

    return NextResponse.json({
      success: true,
      pdfUrl: url,
      responseId: savedResponse.id,
    });

  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

// Helper function to wrap text
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}