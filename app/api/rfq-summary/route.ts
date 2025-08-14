import { NextResponse } from "next/server";
import { db } from "@/db";
import { rfqSummaries } from "@/db/schema";
import { desc } from "drizzle-orm";

function extractObjectKey(urlOrKey: string): string {
  try {
    const url = new URL(urlOrKey);
    return decodeURIComponent(url.pathname.substring(1));
  } catch {
    return urlOrKey;
  }
}

export async function GET() {
  try {
    const summaries = await db.query.rfqSummaries.findMany({
      orderBy: desc(rfqSummaries.createdAt),
    });

    return NextResponse.json(summaries);
  } catch (error) {
    console.error("Error fetching RFQ summaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQ summaries" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, s3Url, s3Key, summary } = body;

    if (!filename || (!s3Url && !s3Key) || !summary) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const rfqNumberMatch = summary.match(/RFQ Number:\s*(\d+[-\s]?\d+)/i);
    const vendorMatch = summary.match(/Company Name:\s*([^\n]+)/i);
    const dateMatch = summary.match(/RFQ Date:\s*(\d{2}\/\d{2}\/\d{4})/i);
    const requestDate = dateMatch ? new Date(dateMatch[1]).toISOString() : null;

    const insertResult = await db
      .insert(rfqSummaries)
      .values({
        filename,
        s3Url:
          s3Url ||
          `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
        summary,
        rfqNumber: rfqNumberMatch ? rfqNumberMatch[1] : null,
        vendor: vendorMatch ? vendorMatch[1].trim() : null,
        requestDate,
        s3Key: s3Key || extractObjectKey(s3Url),
      })
      .returning();

    return NextResponse.json(insertResult[0]);
  } catch (error) {
    console.error("Error saving RFQ summary:", error);
    return NextResponse.json(
      { error: "Failed to save RFQ summary" },
      { status: 500 },
    );
  }
}
