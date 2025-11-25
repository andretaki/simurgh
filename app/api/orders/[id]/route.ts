import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { governmentOrders, qualitySheets, generatedLabels } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { GovernmentOrderUpdateSchema, validateRequestBody } from "@/lib/validations/api";

// GET /api/orders/[id] - Get single order with quality sheet and labels
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const [order] = await db
      .select()
      .from(governmentOrders)
      .where(eq(governmentOrders.id, orderId));

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get quality sheet
    const [qualitySheet] = await db
      .select()
      .from(qualitySheets)
      .where(eq(qualitySheets.orderId, orderId));

    // Get generated labels
    const labels = await db
      .select()
      .from(generatedLabels)
      .where(eq(generatedLabels.orderId, orderId));

    return NextResponse.json({
      order,
      qualitySheet: qualitySheet || null,
      labels,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[id] - Update order
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const validation = await validateRequestBody(request, GovernmentOrderUpdateSchema);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    const [updatedOrder] = await db
      .update(governmentOrders)
      .set({
        ...(data.poNumber !== undefined && { poNumber: data.poNumber }),
        ...(data.productName !== undefined && { productName: data.productName }),
        ...(data.productDescription !== undefined && { productDescription: data.productDescription }),
        ...(data.grade !== undefined && { grade: data.grade }),
        ...(data.nsn !== undefined && { nsn: data.nsn, nsnBarcode: data.nsn ? data.nsn.replace(/-/g, "") : null }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unitOfMeasure !== undefined && { unitOfMeasure: data.unitOfMeasure }),
        ...(data.unitContents !== undefined && { unitContents: data.unitContents }),
        ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice ? String(data.unitPrice) : null }),
        ...(data.totalPrice !== undefined && { totalPrice: data.totalPrice ? String(data.totalPrice) : null }),
        ...(data.spec !== undefined && { spec: data.spec }),
        ...(data.milStd !== undefined && { milStd: data.milStd }),
        ...(data.shipToName !== undefined && { shipToName: data.shipToName }),
        ...(data.shipToAddress !== undefined && { shipToAddress: data.shipToAddress }),
        ...(data.deliveryDate !== undefined && { deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null }),
        ...(data.status !== undefined && { status: data.status }),
        updatedAt: new Date(),
      })
      .where(eq(governmentOrders.id, orderId))
      .returning();

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id] - Delete order
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    await db.delete(governmentOrders).where(eq(governmentOrders.id, orderId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
