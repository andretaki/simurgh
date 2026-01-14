import { db } from "@/lib/db";
import { governmentOrders, rfqDocuments, rfqResponses } from "@/drizzle/migrations/schema";
import { sql, eq, and } from "drizzle-orm";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface ActionGroup {
  id: string;
  label: string;
  items: ActionItem[];
}

interface ActionItem {
  type: "rfq" | "order";
  id: number;
  identifier: string;
  title: string;
  subtitle: string;
  value: string | null;
  dueDate: Date | null;
  urgency: "urgent" | "attention" | "ready";
  meta: string[];
  actions: { label: string; href: string }[];
}

export async function GET() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    // Fetch RFQs needing attention
    const rfqsNeedingAction = await db
      .select({
        id: rfqDocuments.id,
        rfqNumber: rfqDocuments.rfqNumber,
        dueDate: rfqDocuments.dueDate,
        contractingOffice: rfqDocuments.contractingOffice,
        extractedFields: rfqDocuments.extractedFields,
        status: rfqDocuments.status,
        hasResponse: sql<boolean>`EXISTS (
          SELECT 1 FROM ${rfqResponses}
          WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
          AND ${rfqResponses.status} != 'draft'
        )`.as('has_response'),
      })
      .from(rfqDocuments)
      .where(
        and(
          eq(rfqDocuments.status, "processed"),
          sql`NOT EXISTS (
            SELECT 1 FROM ${rfqResponses}
            WHERE ${rfqResponses.rfqDocumentId} = ${rfqDocuments.id}
            AND ${rfqResponses.status} IN ('completed', 'submitted')
          )`
        )
      );

    // Fetch Orders by stage
    const ordersNeedingAction = await db
      .select({
        id: governmentOrders.id,
        poNumber: governmentOrders.poNumber,
        productName: governmentOrders.productName,
        nsn: governmentOrders.nsn,
        quantity: governmentOrders.quantity,
        unitOfMeasure: governmentOrders.unitOfMeasure,
        totalPrice: governmentOrders.totalPrice,
        deliveryDate: governmentOrders.deliveryDate,
        stage: governmentOrders.stage,
        status: governmentOrders.status,
      })
      .from(governmentOrders)
      .where(
        sql`(${governmentOrders.stage} IS NULL OR ${governmentOrders.stage} NOT IN ('closed'))`
      );

    // Group items by action type
    const groups: ActionGroup[] = [];

    // DUE TODAY - RFQs with response due today
    const dueTodayRfqs = rfqsNeedingAction.filter(rfq => {
      if (!rfq.dueDate) return false;
      const due = new Date(rfq.dueDate);
      return due.toDateString() === today.toDateString();
    });

    if (dueTodayRfqs.length > 0) {
      groups.push({
        id: "due-today",
        label: "DUE TODAY",
        items: dueTodayRfqs.map(rfq => ({
          type: "rfq" as const,
          id: rfq.id,
          identifier: rfq.rfqNumber || `RFQ-${rfq.id}`,
          title: rfq.rfqNumber || `RFQ-${rfq.id}`,
          subtitle: rfq.contractingOffice || "Unknown Agency",
          value: formatValue(rfq.extractedFields),
          dueDate: rfq.dueDate,
          urgency: "urgent" as const,
          meta: getItemMeta(rfq.extractedFields),
          actions: [
            { label: "No Bid", href: `/rfq/${rfq.id}?action=no-bid` },
            { label: "Start Quote", href: `/rfq/${rfq.id}/fill` },
          ],
        })),
      });
    }

    // DUE THIS WEEK - RFQs due within 7 days
    const dueThisWeekRfqs = rfqsNeedingAction.filter(rfq => {
      if (!rfq.dueDate) return false;
      const due = new Date(rfq.dueDate);
      return due > today && due <= endOfWeek;
    });

    if (dueThisWeekRfqs.length > 0) {
      groups.push({
        id: "due-this-week",
        label: "DUE THIS WEEK",
        items: dueThisWeekRfqs.map(rfq => ({
          type: "rfq" as const,
          id: rfq.id,
          identifier: rfq.rfqNumber || `RFQ-${rfq.id}`,
          title: rfq.rfqNumber || `RFQ-${rfq.id}`,
          subtitle: rfq.contractingOffice || "Unknown Agency",
          value: formatValue(rfq.extractedFields),
          dueDate: rfq.dueDate,
          urgency: "attention" as const,
          meta: getItemMeta(rfq.extractedFields),
          actions: [
            { label: "No Bid", href: `/rfq/${rfq.id}?action=no-bid` },
            { label: "Start Quote", href: `/rfq/${rfq.id}/fill` },
          ],
        })),
      });
    }

    // NEEDS VERIFICATION - Orders in received stage (or null stage)
    const needsVerification = ordersNeedingAction.filter(o =>
      o.stage === "received" || o.stage === null
    );
    if (needsVerification.length > 0) {
      groups.push({
        id: "needs-verification",
        label: "NEEDS VERIFICATION",
        items: needsVerification.map(order => ({
          type: "order" as const,
          id: order.id,
          identifier: `PO ${order.poNumber}`,
          title: `PO ${order.poNumber}`,
          subtitle: order.productName,
          value: order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : null,
          dueDate: order.deliveryDate,
          urgency: "attention" as const,
          meta: [`${order.quantity} ${order.unitOfMeasure || 'units'}`, order.nsn || 'No NSN'].filter(Boolean),
          actions: [
            { label: "Verify Order", href: `/orders/${order.id}` },
          ],
        })),
      });
    }

    // NEEDS SOURCING - Orders in verified or sourcing stage
    const needsSourcing = ordersNeedingAction.filter(o =>
      o.stage === "verified" || o.stage === "sourcing"
    );
    if (needsSourcing.length > 0) {
      groups.push({
        id: "needs-sourcing",
        label: "NEEDS SOURCING",
        items: needsSourcing.map(order => ({
          type: "order" as const,
          id: order.id,
          identifier: `PO ${order.poNumber}`,
          title: `PO ${order.poNumber}`,
          subtitle: order.productName,
          value: order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : null,
          dueDate: order.deliveryDate,
          urgency: "attention" as const,
          meta: [`${order.quantity} ${order.unitOfMeasure || 'units'}`],
          actions: [
            { label: "Add Vendor + Cost", href: `/orders/${order.id}` },
          ],
        })),
      });
    }

    // READY FOR QC - Orders in fulfilling or qc stage
    const readyForQc = ordersNeedingAction.filter(o =>
      o.stage === "fulfilling" || o.stage === "qc"
    );
    if (readyForQc.length > 0) {
      groups.push({
        id: "ready-for-qc",
        label: "READY FOR QC",
        items: readyForQc.map(order => ({
          type: "order" as const,
          id: order.id,
          identifier: `PO ${order.poNumber}`,
          title: `PO ${order.poNumber}`,
          subtitle: order.productName,
          value: order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : null,
          dueDate: order.deliveryDate,
          urgency: "ready" as const,
          meta: [`${order.quantity} ${order.unitOfMeasure || 'units'}`],
          actions: [
            { label: "Start QC Checklist", href: `/orders/${order.id}` },
          ],
        })),
      });
    }

    // READY TO SHIP - Orders in ship stage
    const readyToShip = ordersNeedingAction.filter(o => o.stage === "ship");
    if (readyToShip.length > 0) {
      groups.push({
        id: "ready-to-ship",
        label: "READY TO SHIP",
        items: readyToShip.map(order => ({
          type: "order" as const,
          id: order.id,
          identifier: `PO ${order.poNumber}`,
          title: `PO ${order.poNumber}`,
          subtitle: order.productName,
          value: order.totalPrice ? `$${Number(order.totalPrice).toLocaleString()}` : null,
          dueDate: order.deliveryDate,
          urgency: "ready" as const,
          meta: [`${order.quantity} ${order.unitOfMeasure || 'units'}`],
          actions: [
            { label: "Print Label", href: `/orders/${order.id}` },
            { label: "Mark Shipped", href: `/orders/${order.id}?action=ship` },
          ],
        })),
      });
    }

    // OVERDUE - RFQs past due date
    const overdueRfqs = rfqsNeedingAction.filter(rfq => {
      if (!rfq.dueDate) return false;
      const due = new Date(rfq.dueDate);
      return due < today;
    });

    if (overdueRfqs.length > 0) {
      groups.push({
        id: "overdue",
        label: "OVERDUE",
        items: overdueRfqs.map(rfq => ({
          type: "rfq" as const,
          id: rfq.id,
          identifier: rfq.rfqNumber || `RFQ-${rfq.id}`,
          title: rfq.rfqNumber || `RFQ-${rfq.id}`,
          subtitle: rfq.contractingOffice || "Unknown Agency",
          value: formatValue(rfq.extractedFields),
          dueDate: rfq.dueDate,
          urgency: "urgent" as const,
          meta: getItemMeta(rfq.extractedFields),
          actions: [
            { label: "No Bid", href: `/rfq/${rfq.id}?action=no-bid` },
          ],
        })),
      });
    }

    const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

    return apiSuccess({
      groups,
      totalCount,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching action required items", error);
    return apiError("Failed to fetch action items", 500);
  }
}

function formatValue(extractedFields: unknown): string | null {
  if (!extractedFields || typeof extractedFields !== 'object') return null;
  const fields = extractedFields as Record<string, unknown>;
  if (fields.estimatedValue) {
    const val = Number(fields.estimatedValue);
    if (!isNaN(val)) {
      return `$${val.toLocaleString()}`;
    }
  }
  return null;
}

function getItemMeta(extractedFields: unknown): string[] {
  const meta: string[] = [];
  if (!extractedFields || typeof extractedFields !== 'object') return meta;
  const fields = extractedFields as Record<string, unknown>;

  if (fields.lineItems && Array.isArray(fields.lineItems)) {
    meta.push(`${fields.lineItems.length} items`);
  }
  if (fields.hazmat) {
    meta.push("Hazmat");
  }
  return meta;
}
