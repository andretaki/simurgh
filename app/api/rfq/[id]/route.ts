import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@/lib/aws/s3";

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

    const rfq = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, rfqId))
      .limit(1);

    if (rfq.length === 0) {
      return NextResponse.json(
        { error: "RFQ not found" },
        { status: 404 }
      );
    }

    const rfqData = rfq[0];

    // Generate fresh presigned URL if we have an s3Key
    let s3Url = rfqData.s3Url;
    if (rfqData.s3Key) {
      try {
        s3Url = await getPresignedDownloadUrl(rfqData.s3Key);
      } catch (e) {
        console.error("Failed to generate presigned URL:", e);
      }
    }

    return NextResponse.json({
      ...rfqData,
      s3Url,
    });
  } catch (error) {
    console.error("Error fetching RFQ:", error);
    return NextResponse.json(
      { error: "Failed to fetch RFQ" },
      { status: 500 }
    );
  }
}