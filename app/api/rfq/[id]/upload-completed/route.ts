import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqResponses, companyProfiles } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rfqId = parseInt(params.id);
    const { pdfUrl, s3Key, responseData } = await request.json();

    if (isNaN(rfqId)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID" },
        { status: 400 }
      );
    }

    if (!pdfUrl || !s3Key) {
      return NextResponse.json(
        { error: "Missing pdfUrl or s3Key" },
        { status: 400 }
      );
    }

    // Get company profile if exists
    const profiles = await db.select().from(companyProfiles).limit(1);
    const profile = profiles[0] || null;

    // Check if a response already exists for this RFQ
    const existingResponses = await db
      .select()
      .from(rfqResponses)
      .where(eq(rfqResponses.rfqDocumentId, rfqId))
      .limit(1);

    let savedResponse;

    if (existingResponses.length > 0) {
      // Update existing response with the manually filled PDF
      [savedResponse] = await db
        .update(rfqResponses)
        .set({
          responseData: responseData || existingResponses[0].responseData,
          companyProfileId: profile?.id || null,
          status: "submitted",
          generatedPdfUrl: pdfUrl,
          generatedPdfS3Key: s3Key,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rfqResponses.id, existingResponses[0].id))
        .returning();
    } else {
      // Create new response with the manually filled PDF
      [savedResponse] = await db
        .insert(rfqResponses)
        .values({
          rfqDocumentId: rfqId,
          companyProfileId: profile?.id || null,
          responseData: responseData || {},
          status: "submitted",
          generatedPdfUrl: pdfUrl,
          generatedPdfS3Key: s3Key,
          submittedAt: new Date(),
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      responseId: savedResponse.id,
      pdfUrl,
      message: "Completed PDF uploaded successfully",
    });

  } catch (error) {
    console.error("Error uploading completed PDF:", error);
    return NextResponse.json(
      { error: "Failed to save completed PDF" },
      { status: 500 }
    );
  }
}
