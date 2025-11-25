// app/api/s3/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { S3UploadSchema } from "@/lib/validations/api";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const parseResult = S3UploadSchema.safeParse(requestBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { filename, contentType = "application/pdf" } = parseResult.data;

    const bucketName = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;

    if (!bucketName || !region) {
      return NextResponse.json(
        { error: "S3 configuration missing" },
        { status: 500 }
      );
    }

    const client = new S3Client({ region });
    const key = `uploads/${uuidv4()}.pdf`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 600 });

    return NextResponse.json({ url, key });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate upload URL";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
