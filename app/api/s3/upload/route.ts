// app/api/s3/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { filename, contentType = "application/pdf" } = requestBody;

    // --- START Added Logs ---
    console.log("--- Debugging S3 Upload Params ---");
    console.log("Value of bucketName:", process.env.AWS_S3_BUCKET);
    console.log("Type of bucketName:", typeof process.env.AWS_S3_BUCKET);
    console.log("Value of region:", process.env.AWS_REGION);
    console.log("Type of region:", typeof process.env.AWS_REGION);
    console.log("Value of contentType:", contentType);
    console.log("Type of contentType:", typeof contentType);
    // --- END Added Logs ---

    // Validation checks
    if (!filename) {
      console.error("Missing required field: filename");
      return NextResponse.json(
        { error: "Filename is required." },
        { status: 400 },
      );
    }

    const bucketName = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;

    // Ensure all required parameters are present
    if (!bucketName || !region || !contentType) {
      console.error("Validation failed just before S3 call!");
      return NextResponse.json(
        { error: "Internal configuration or request error" },
        { status: 500 },
      );
    }

    const client = new S3Client({ region });
    const key = `uploads/${uuidv4()}.pdf`;

    console.log(
      `Attempting to create presigned URL with Bucket: ${bucketName}, Key: ${key}, ContentType: ${contentType}`,
    );

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 600 });
    console.log("Successfully generated presigned URL");

    return NextResponse.json({ url, key });
  } catch (error: any) {
    console.error("Error caught during presigned URL generation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
