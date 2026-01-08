import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";

// Only allow in development/test environments
const isTestEnv = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';

export async function POST(request: NextRequest) {
  if (!isTestEnv) {
    return NextResponse.json(
      { error: "This endpoint is only available in test environments" },
      { status: 403 }
    );
  }

  try {
    const data = await request.json();

    // Create test RFQ directly in database
    const [rfq] = await db
      .insert(rfqDocuments)
      .values({
        fileName: data.fileName || `test-rfq-${Date.now()}.pdf`,
        s3Key: `e2e-test/${Date.now()}/test.pdf`,
        s3Url: 'https://example.com/test.pdf', // Fake URL for testing
        fileSize: 1024,
        mimeType: 'application/pdf',
        extractedText: 'E2E Test RFQ Document',
        extractedFields: data.extractedFields || {},
        rfqNumber: data.rfqNumber || `E2E-${Date.now()}`,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        contractingOffice: data.contractingOffice || 'E2E Test Office',
        status: 'processed',
      })
      .returning();

    return NextResponse.json({
      id: rfq.id,
      message: 'Test RFQ created successfully',
    });
  } catch (error) {
    console.error("Error creating test RFQ:", error);
    return NextResponse.json(
      { error: "Failed to create test RFQ" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isTestEnv) {
    return NextResponse.json(
      { error: "This endpoint is only available in test environments" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: "Missing RFQ ID" },
        { status: 400 }
      );
    }

    await db
      .delete(rfqDocuments)
      .where(eq(rfqDocuments.id, parseInt(id)));

    return NextResponse.json({
      message: 'Test RFQ deleted successfully',
    });
  } catch (error) {
    console.error("Error deleting test RFQ:", error);
    return NextResponse.json(
      { error: "Failed to delete test RFQ" },
      { status: 500 }
    );
  }
}
