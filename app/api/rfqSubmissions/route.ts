import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqResponses, rfqDocuments } from "@/drizzle/migrations/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const submissions = await db
      .select({
        id: rfqResponses.id,
        filename: rfqDocuments.fileName,
        completedPdfUrl: rfqResponses.generatedPdfUrl,
        s3Key: rfqDocuments.s3Key,
        createdAt: rfqResponses.createdAt,
        formData: rfqResponses.formData,
      })
      .from(rfqResponses)
      .leftJoin(rfqDocuments, eq(rfqResponses.rfqDocumentId, rfqDocuments.id))
      .orderBy(desc(rfqResponses.createdAt));

    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json([], { status: 200 });
  }
}
