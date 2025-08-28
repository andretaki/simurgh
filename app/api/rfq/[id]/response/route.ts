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
    const { responseData } = await request.json();

    if (isNaN(rfqId)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID" },
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
      // Update existing response
      [savedResponse] = await db
        .update(rfqResponses)
        .set({
          responseData,
          companyProfileId: profile?.id || null,
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(rfqResponses.id, existingResponses[0].id))
        .returning();
    } else {
      // Create new response
      [savedResponse] = await db
        .insert(rfqResponses)
        .values({
          rfqDocumentId: rfqId,
          companyProfileId: profile?.id || null,
          responseData,
          status: "draft",
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      responseId: savedResponse.id,
      message: "Response saved successfully",
    });

  } catch (error) {
    console.error("Error saving response:", error);
    return NextResponse.json(
      { error: "Failed to save response" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rfqId = parseInt(params.id);

    if (isNaN(rfqId)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID" },
        { status: 400 }
      );
    }

    const responses = await db
      .select()
      .from(rfqResponses)
      .where(eq(rfqResponses.rfqDocumentId, rfqId))
      .limit(1);

    if (responses.length === 0) {
      return NextResponse.json({ response: null });
    }

    return NextResponse.json({ response: responses[0] });

  } catch (error) {
    console.error("Error fetching response:", error);
    return NextResponse.json(
      { error: "Failed to fetch response" },
      { status: 500 }
    );
  }
}