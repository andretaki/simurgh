import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    // Fetch all RFQ documents
    const rfqs = await db
      .select()
      .from(rfqDocuments)
      .orderBy(desc(rfqDocuments.createdAt));

    // Fetch all responses
    const responses = await db
      .select()
      .from(rfqResponses)
      .orderBy(desc(rfqResponses.createdAt));

    return NextResponse.json({
      rfqs,
      responses,
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}