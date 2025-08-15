import { NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@/lib/aws/s3";

export async function POST(request: Request) {
  try {
    const { fileName, contentType } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      );
    }

    // Generate a unique key for the file
    const timestamp = Date.now();
    const key = `rfqs/${timestamp}-${fileName}`;

    // Get presigned upload URL
    const uploadUrl = await getPresignedUploadUrl(key, contentType || "application/pdf");

    return NextResponse.json({
      uploadUrl,
      key,
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}