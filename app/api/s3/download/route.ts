// app/api/rfq/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/db";
import { rfqSubmissions, rfqSummaries } from "@/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";

// Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Helper function to validate environment variables
function validateEnvironment(): string | null {
  if (!process.env.AWS_S3_BUCKET) {
    logger.error("AWS_S3_BUCKET is not set in environment variables");
    return "AWS bucket configuration is missing";
  }
  if (!process.env.AWS_REGION) {
    logger.error("AWS_REGION is not set in environment variables");
    return "AWS region configuration is missing";
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.error("AWS credentials are not properly configured");
    return "AWS credentials are missing";
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Check environment configuration
    const envError = validateEnvironment();
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }

    // Parse and validate the RFQ ID
    const { searchParams } = new URL(request.url);
    const rfqId = searchParams.get("rfqId");
    const type = searchParams.get("type"); // 'submission' or undefined for original

    if (!rfqId) {
      return NextResponse.json(
        { error: "RFQ ID is required" },
        { status: 400 },
      );
    }

    const rfqIdNumber = parseInt(rfqId, 10);
    if (isNaN(rfqIdNumber)) {
      return NextResponse.json(
        { error: "Invalid RFQ ID format" },
        { status: 400 },
      );
    }

    let objectKey: string | null = null;

    if (type === "submission") {
      // Look for completed submission
      const submission = await db.query.rfqSubmissions.findFirst({
        where: eq(rfqSubmissions.id, rfqIdNumber),
      });

      if (!submission) {
        return NextResponse.json(
          { error: "Submission not found" },
          { status: 404 },
        );
      }

      // Extract key from completedPdfUrl if available
      if (submission.completedPdfUrl) {
        try {
          const url = new URL(submission.completedPdfUrl);
          objectKey = decodeURIComponent(url.pathname.substring(1));
        } catch {
          // If not a URL, use it directly
          objectKey = submission.completedPdfUrl;
        }
      }
    } else {
      // Look for original RFQ
      const summary = await db.query.rfqSummaries.findFirst({
        where: eq(rfqSummaries.id, rfqIdNumber),
      });

      if (!summary) {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
      }

      // Extract key from s3Key or s3Url
      if (summary.s3Key) {
        objectKey = summary.s3Key;
      } else if (summary.s3Url) {
        try {
          const url = new URL(summary.s3Url);
          objectKey = decodeURIComponent(url.pathname.substring(1));
        } catch {
          objectKey = summary.s3Url;
        }
      }
    }

    if (!objectKey) {
      return NextResponse.json(
        { error: "PDF not found for this RFQ" },
        { status: 404 },
      );
    }

    // Remove 'rfq/' prefix if it exists before adding it again
    objectKey = objectKey.replace(/^rfq\//, "");
    // Add 'rfq/' prefix
    objectKey = `rfq/${objectKey}`;

    // Generate the presigned URL
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: objectKey,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    return NextResponse.json({ url });
  } catch (error: unknown) {
    logger.error("Error generating presigned GET URL", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to generate download URL",
        details: message,
      },
      { status: 500 },
    );
  }
}
