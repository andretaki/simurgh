import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqResponses } from "@/drizzle/migrations/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Save response to database
    const [response] = await db.insert(rfqResponses).values({
      rfqDocumentId: data.rfqId,
      responseData: data,
      pdfGenerated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return NextResponse.json({ 
      success: true, 
      id: response.id,
      message: "Response saved successfully"
    });
    
  } catch (error) {
    console.error("Error saving response:", error);
    return NextResponse.json(
      { error: "Failed to save response" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rfqId = searchParams.get("rfqId");
    
    if (!rfqId) {
      return NextResponse.json(
        { error: "RFQ ID required" },
        { status: 400 }
      );
    }
    
    const responses = await db
      .select()
      .from(rfqResponses)
      .where(eq(rfqResponses.rfqDocumentId, parseInt(rfqId)))
      .orderBy(desc(rfqResponses.createdAt));
    
    return NextResponse.json(responses);
    
  } catch (error) {
    console.error("Error fetching responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch responses" },
      { status: 500 }
    );
  }
}