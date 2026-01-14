import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    // Get all RFQs with their latest response status
    const rfqs = await db
      .select({
        id: rfqDocuments.id,
        rfqNumber: rfqDocuments.rfqNumber,
        fileName: rfqDocuments.fileName,
        s3Url: rfqDocuments.s3Url,
        dueDate: rfqDocuments.dueDate,
        contractingOffice: rfqDocuments.contractingOffice,
        extractedFields: rfqDocuments.extractedFields,
        status: rfqDocuments.status,
        createdAt: rfqDocuments.createdAt,
        responseStatus: sql<string | null>`(
          SELECT ${rfqResponses.status} FROM ${rfqResponses}
          WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
          ORDER BY ${rfqResponses.createdAt} DESC
          LIMIT 1
        )`.as("responseStatus"),
      })
      .from(rfqDocuments)
      .orderBy(desc(rfqDocuments.createdAt));

    return NextResponse.json({ rfqs });
  } catch (error) {
    console.error("Failed to fetch RFQs:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQs" },
      { status: 500 }
    );
  }
}
