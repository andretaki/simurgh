import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqDocuments } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";

/**
 * E2E Test Seeding Endpoint
 *
 * SECURITY: This endpoint is dangerous and must be properly gated.
 * It is blocked in production and requires a secret header in other environments.
 */

// Hard block in production - no exceptions
const isProduction = process.env.NODE_ENV === "production";

// Secret required for access (set E2E_SEED_SECRET in your test environment)
const E2E_SECRET = process.env.E2E_SEED_SECRET;

function validateAccess(request: NextRequest): { allowed: boolean; error?: string } {
  // HARD BLOCK: Never allow in production
  if (isProduction) {
    return { allowed: false, error: "Not found" };
  }

  // If no secret is configured, block access entirely
  if (!E2E_SECRET) {
    return {
      allowed: false,
      error: "E2E_SEED_SECRET not configured. Set this environment variable to enable test seeding."
    };
  }

  // Validate secret header
  const providedSecret = request.headers.get("x-e2e-secret");
  if (providedSecret !== E2E_SECRET) {
    return { allowed: false, error: "Unauthorized" };
  }

  return { allowed: true };
}

export async function POST(request: NextRequest) {
  const access = validateAccess(request);

  if (!access.allowed) {
    // Return 404 in production to hide the endpoint's existence
    if (isProduction) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "Unauthorized" ? 401 : 403 }
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
        s3Url: "https://example.com/test.pdf", // Fake URL for testing
        fileSize: 1024,
        mimeType: "application/pdf",
        extractedText: "E2E Test RFQ Document",
        extractedFields: data.extractedFields || {},
        rfqNumber: data.rfqNumber || `E2E-${Date.now()}`,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        contractingOffice: data.contractingOffice || "E2E Test Office",
        status: "processed",
      })
      .returning();

    return NextResponse.json({
      id: rfq.id,
      message: "Test RFQ created successfully",
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
  const access = validateAccess(request);

  if (!access.allowed) {
    if (isProduction) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "Unauthorized" ? 401 : 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing RFQ ID" },
        { status: 400 }
      );
    }

    await db.delete(rfqDocuments).where(eq(rfqDocuments.id, parseInt(id)));

    return NextResponse.json({
      message: "Test RFQ deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting test RFQ:", error);
    return NextResponse.json(
      { error: "Failed to delete test RFQ" },
      { status: 500 }
    );
  }
}
