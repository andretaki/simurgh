import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatedLabels, governmentOrders } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";
import { generateLabelPDF } from "@/lib/label-generator";

// POST /api/orders/[id]/labels - Generate label PDF
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

    // Generate the PDF
    const pdfBase64 = generateLabelPDF({
      labelType: data.labelType,
      labelSize: data.labelSize,
      productName: data.productName,
      grade: data.grade,
      spec: data.spec,
      nsn: data.nsn,
      nsnBarcode: data.nsnBarcode,
      cageCode: data.cageCode,
      poNumber: data.poNumber,
      lotNumber: data.lotNumber,
      quantity: data.quantity,
      weight: data.weight,
      assemblyDate: data.assemblyDate,
      inspectionDate: data.inspectionDate,
      mhmDate: data.mhmDate,
      containerType: data.containerType,
      hazardSymbols: data.hazardSymbols,
    });

    // Save label record to database
    const [label] = await db
      .insert(generatedLabels)
      .values({
        orderId,
        qualitySheetId: data.qualitySheetId || null,
        labelType: data.labelType,
        labelSize: data.labelSize,
        productName: data.productName,
        grade: data.grade,
        spec: data.spec,
        nsn: data.nsn,
        nsnBarcode: data.nsnBarcode,
        cageCode: data.cageCode,
        poNumber: data.poNumber,
        lotNumber: data.lotNumber,
        quantity: data.quantity,
        weight: data.weight,
        assemblyDate: data.assemblyDate,
        inspectionDate: data.inspectionDate,
        mhmDate: data.mhmDate,
        containerType: data.containerType,
        hazardClass: data.hazardClass,
        unNumber: data.unNumber,
        printCount: 0,
      })
      .returning();

    // Update order status if this is the first label
    const existingLabels = await db
      .select()
      .from(generatedLabels)
      .where(eq(generatedLabels.orderId, orderId));

    if (existingLabels.length === 1) {
      await db
        .update(governmentOrders)
        .set({
          status: "labels_generated",
          updatedAt: new Date(),
        })
        .where(eq(governmentOrders.id, orderId));
    }

    return NextResponse.json({
      label,
      pdfBase64,
    });
  } catch (error) {
    console.error("Error generating label:", error);
    return NextResponse.json(
      { error: "Failed to generate label" },
      { status: 500 }
    );
  }
}

// GET /api/orders/[id]/labels - Get all labels for an order
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

    const labels = await db
      .select()
      .from(generatedLabels)
      .where(eq(generatedLabels.orderId, orderId));

    return NextResponse.json({ labels });
  } catch (error) {
    console.error("Error fetching labels:", error);
    return NextResponse.json(
      { error: "Failed to fetch labels" },
      { status: 500 }
    );
  }
}
