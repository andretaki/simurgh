import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { governmentOrders, qualitySheets, generatedLabels } from "@/drizzle/migrations/schema";
import { desc, eq, sql } from "drizzle-orm";
import { GovernmentOrderCreateSchema, validateRequestBody } from "@/lib/validations/api";
import { apiSuccess, apiError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET /api/orders - List all government orders
export async function GET() {
  try {
    // Use a single query with subqueries to avoid N+1 problem
    const ordersWithCounts = await db
      .select({
        id: governmentOrders.id,
        poNumber: governmentOrders.poNumber,
        productName: governmentOrders.productName,
        productDescription: governmentOrders.productDescription,
        grade: governmentOrders.grade,
        nsn: governmentOrders.nsn,
        nsnBarcode: governmentOrders.nsnBarcode,
        quantity: governmentOrders.quantity,
        unitOfMeasure: governmentOrders.unitOfMeasure,
        unitContents: governmentOrders.unitContents,
        unitPrice: governmentOrders.unitPrice,
        totalPrice: governmentOrders.totalPrice,
        spec: governmentOrders.spec,
        milStd: governmentOrders.milStd,
        shipToName: governmentOrders.shipToName,
        shipToAddress: governmentOrders.shipToAddress,
        deliveryDate: governmentOrders.deliveryDate,
        originalPdfS3Key: governmentOrders.originalPdfS3Key,
        originalPdfUrl: governmentOrders.originalPdfUrl,
        extractedData: governmentOrders.extractedData,
        status: governmentOrders.status,
        createdAt: governmentOrders.createdAt,
        updatedAt: governmentOrders.updatedAt,
        hasQualitySheet: sql<boolean>`EXISTS (
          SELECT 1 FROM ${qualitySheets}
          WHERE ${qualitySheets.orderId} = ${governmentOrders.id}
        )`.as('has_quality_sheet'),
        labelCount: sql<number>`(
          SELECT COUNT(*) FROM ${generatedLabels}
          WHERE ${generatedLabels.orderId} = ${governmentOrders.id}
        )`.as('label_count'),
      })
      .from(governmentOrders)
      .orderBy(desc(governmentOrders.createdAt));

    // Get quality sheets in a single query for orders that have them
    const orderIds = ordersWithCounts.map(o => o.id);
    const allQualitySheets = orderIds.length > 0
      ? await db
          .select()
          .from(qualitySheets)
          .where(sql`${qualitySheets.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    // Map quality sheets to orders
    const qualitySheetMap = new Map(allQualitySheets.map(qs => [qs.orderId, qs]));

    const ordersWithQualitySheets = ordersWithCounts.map(order => ({
      ...order,
      qualitySheet: qualitySheetMap.get(order.id) || null,
    }));

    return apiSuccess({ orders: ordersWithQualitySheets });
  } catch (error: unknown) {
    logger.error("Error fetching orders", error);
    // Return empty array if table doesn't exist (42P01 = relation does not exist)
    if (error && typeof error === "object" && "code" in error && error.code === "42P01") {
      return apiSuccess({ orders: [] });
    }
    return apiError("Failed to fetch orders", 500);
  }
}

// POST /api/orders - Create a new order (from uploaded PO data)
export async function POST(request: Request) {
  try {
    const validation = await validateRequestBody(request, GovernmentOrderCreateSchema);

    if (!validation.success) {
      return apiValidationError(validation.error, validation.details.errors);
    }

    const data = validation.data;

    const [newOrder] = await db
      .insert(governmentOrders)
      .values({
        poNumber: data.poNumber,
        productName: data.productName,
        productDescription: data.productDescription || null,
        grade: data.grade || null,
        nsn: data.nsn || null,
        nsnBarcode: data.nsn ? data.nsn.replace(/-/g, "") : null,
        quantity: data.quantity,
        unitOfMeasure: data.unitOfMeasure || null,
        unitContents: data.unitContents || null,
        unitPrice: data.unitPrice ? String(data.unitPrice) : null,
        totalPrice: data.totalPrice ? String(data.totalPrice) : null,
        spec: data.spec || null,
        milStd: data.milStd || null,
        shipToName: data.shipToName || null,
        shipToAddress: data.shipToAddress || null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        originalPdfS3Key: data.originalPdfS3Key || null,
        originalPdfUrl: data.originalPdfUrl || null,
        extractedData: data.extractedData || null,
        status: "pending",
      })
      .returning();

    return apiSuccess({ order: newOrder });
  } catch (error: unknown) {
    logger.error("Error creating order", error);
    return apiError("Failed to create order", 500);
  }
}
