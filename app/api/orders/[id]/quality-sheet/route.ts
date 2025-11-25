import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qualitySheets, governmentOrders } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";

// POST /api/orders/[id]/quality-sheet - Create or update quality sheet
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    const data = await request.json();

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    // Check if quality sheet already exists for this order
    const [existingSheet] = await db
      .select()
      .from(qualitySheets)
      .where(eq(qualitySheets.orderId, orderId));

    let qualitySheet;

    if (existingSheet) {
      // Update existing
      [qualitySheet] = await db
        .update(qualitySheets)
        .set({
          poNumber: data.poNumber,
          lotNumber: data.lotNumber,
          nsn: data.nsn,
          quantity: data.quantity,
          productType: data.productType,
          shipTo: data.shipTo,
          assemblyDate: data.assemblyDate,
          inspectionDate: data.inspectionDate,
          mhmDate: data.mhmDate,
          cageCode: data.cageCode || "1LT50",
          notes: data.notes,
          verifiedBy: data.verifiedBy,
          verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(qualitySheets.id, existingSheet.id))
        .returning();
    } else {
      // Create new
      [qualitySheet] = await db
        .insert(qualitySheets)
        .values({
          orderId,
          poNumber: data.poNumber,
          lotNumber: data.lotNumber,
          nsn: data.nsn,
          quantity: data.quantity,
          productType: data.productType,
          shipTo: data.shipTo,
          assemblyDate: data.assemblyDate,
          inspectionDate: data.inspectionDate,
          mhmDate: data.mhmDate,
          cageCode: data.cageCode || "1LT50",
          notes: data.notes,
        })
        .returning();
    }

    // Update order status
    await db
      .update(governmentOrders)
      .set({
        status: "quality_sheet_created",
        updatedAt: new Date(),
      })
      .where(eq(governmentOrders.id, orderId));

    return NextResponse.json({ qualitySheet });
  } catch (error) {
    console.error("Error saving quality sheet:", error);
    return NextResponse.json(
      { error: "Failed to save quality sheet" },
      { status: 500 }
    );
  }
}
