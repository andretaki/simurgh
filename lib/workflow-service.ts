// Unified Workflow Service
// Tracks the full RFQ → Response → PO → Fulfillment chain

import { db } from "@/lib/db";
import {
  rfqDocuments,
  rfqResponses,
  governmentOrders,
  governmentOrderRfqLinks,
  qualitySheets,
  generatedLabels,
} from "@/drizzle/migrations/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

/**
 * Workflow status represents the overall state of an RFQ-to-fulfillment cycle
 */
export type WorkflowStatus =
  | "rfq_received"      // RFQ uploaded, no response yet
  | "response_draft"    // Response started but not submitted
  | "response_submitted" // Quote submitted, awaiting PO
  | "no_bid"            // Marked as no-bid
  | "expired"           // RFQ due date passed without submission
  | "lost"              // Submitted, but no award/PO received
  | "po_received"       // PO received, awaiting fulfillment
  | "in_fulfillment"    // Quality sheet and/or labels created
  | "verified"          // Order verified and signed off
  | "shipped";          // Order shipped

/**
 * Complete workflow record with all related documents
 * Supports many-to-many relationships:
 * - One RFQ can be linked to multiple POs (partial awards, consolidated awards)
 * - One PO can be linked to multiple RFQs (consolidated PO from multiple RFQs)
 */
export interface WorkflowRecord {
  // Identifiers (primary)
  rfqNumber: string | null;
  poNumber: string | null;

  // Workflow status
  status: WorkflowStatus;
  statusLabel: string;

  // Primary Documents (for single-item views)
  rfq: {
    id: number;
    fileName: string;
    s3Url: string | null;
    rfqNumber: string | null;
    dueDate: string | null;
    contractingOffice: string | null;
    extractedFields: unknown;
    status: string;
    createdAt: string;
  } | null;

  response: {
    id: number;
    status: string;
    generatedPdfUrl: string | null;
    generatedBrandedQuoteUrl: string | null;
    vendorQuoteRef: string | null;
    quoteValidUntil: string | null;
    submittedAt: string | null;
    responseData: unknown;
    createdAt: string;
  } | null;

  po: {
    id: number;
    poNumber: string;
    rfqNumber: string | null;
    productName: string;
    nsn: string | null;
    quantity: number;
    unitPrice: string | null;
    totalPrice: string | null;
    shipToName: string | null;
    shipToAddress: string | null;
    deliveryDate: string | null;
    status: string;
    extractedData: unknown;
    createdAt: string;
  } | null;

  qualitySheet: {
    id: number;
    lotNumber: string;
    poNumber: string;
    quantity: number;
    verifiedBy: string | null;
    verifiedAt: string | null;
    createdAt: string;
  } | null;

  labels: Array<{
    id: number;
    labelType: string;
    labelSize: string;
    pdfUrl: string | null;
    createdAt: string;
  }>;

  // Many-to-many: All linked POs for this RFQ
  linkedPOs: Array<{
    id: number;
    poNumber: string;
    rfqNumber: string | null;
    productName: string;
    nsn: string | null;
    quantity: number;
    status: string;
    createdAt: string;
  }>;

  // Many-to-many: All linked RFQs for this PO
  linkedRFQs: Array<{
    id: number;
    rfqNumber: string | null;
    fileName: string;
    dueDate: string | null;
    status: string;
    createdAt: string;
  }>;

  // Timestamps
  rfqReceivedAt: string | null;
  responseSubmittedAt: string | null;
  poReceivedAt: string | null;
  verifiedAt: string | null;
}

/**
 * Compute the overall workflow status from the chain of documents
 */
function computeWorkflowStatus(
  rfq: { status: string; dueDate: Date | null } | null,
  response: { status: string; submittedAt: Date | null; responseData: unknown } | null,
  po: { status: string } | null
): { status: WorkflowStatus; label: string } {
  // No RFQ - shouldn't happen but handle it
  if (!rfq) {
    if (po) {
      // PO exists without RFQ (maybe uploaded directly)
      return computePOStatus(po);
    }
    return { status: "rfq_received", label: "Unknown" };
  }

  // RFQ expired (no submitted response and due date passed)
  if (rfq.dueDate) {
    const now = new Date();
    const due = rfq.dueDate;
    const hasSubmittedResponse = response?.status === "submitted" || response?.status === "completed";
    if (!hasSubmittedResponse && due.getTime() < now.getTime()) {
      return { status: "expired", label: "Expired" };
    }
  }

  // Has RFQ, check for response
  if (!response) {
    return { status: "rfq_received", label: "Awaiting Response" };
  }

  // Explicit no-bid (stored in responseData)
  if (response.responseData && typeof response.responseData === "object") {
    const data = response.responseData as Record<string, unknown>;
    const noBidReason = data.noBidReason;
    if (typeof noBidReason === "string" && noBidReason.trim()) {
      return { status: "no_bid", label: "No Bid" };
    }
  }

  // Has response, check status
  if (response.status === "draft") {
    return { status: "response_draft", label: "Response In Progress" };
  }

  if (response.status === "submitted" || response.status === "completed") {
    // Response submitted, check for PO
    if (!po) {
      // If it's been a while since submission, consider it lost (configurable heuristic)
      if (response.submittedAt) {
        const daysSince = (Date.now() - response.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince >= 30) {
          return { status: "lost", label: "Lost" };
        }
      }
      return { status: "response_submitted", label: "Awaiting PO" };
    }
    // Has PO
    return computePOStatus(po);
  }

  return { status: "rfq_received", label: "Awaiting Response" };
}

function computePOStatus(po: { status: string }): { status: WorkflowStatus; label: string } {
  switch (po.status) {
    case "pending":
      return { status: "po_received", label: "PO Received" };
    case "quality_sheet_created":
    case "labels_generated":
      return { status: "in_fulfillment", label: "In Fulfillment" };
    case "verified":
      return { status: "verified", label: "Verified" };
    case "shipped":
      return { status: "shipped", label: "Shipped" };
    default:
      return { status: "po_received", label: "PO Received" };
  }
}

/**
 * Get a single workflow by RFQ number, PO number, or document ID
 */
export async function getWorkflow(identifier: string): Promise<WorkflowRecord | null> {
  // Try to find by RFQ number first
  let rfq = await db.query.rfqDocuments.findFirst({
    where: eq(rfqDocuments.rfqNumber, identifier),
  });

  // Try by PO number if not found
  let po = null;
  if (!rfq) {
    po = await db.query.governmentOrders.findFirst({
      where: eq(governmentOrders.poNumber, identifier),
    });

    // If PO found, try to find linked RFQ(s)
    if (po) {
      const [link] = await db
        .select()
        .from(governmentOrderRfqLinks)
        .where(eq(governmentOrderRfqLinks.governmentOrderId, po.id))
        .limit(1);

      if (link) {
        rfq = await db.query.rfqDocuments.findFirst({
          where: eq(rfqDocuments.id, link.rfqDocumentId),
        });
      } else if (po.rfqDocumentId) {
        // Legacy fallback
        rfq = await db.query.rfqDocuments.findFirst({
          where: eq(rfqDocuments.id, po.rfqDocumentId),
        });
      }
    }
  }

  // Try by numeric ID (rfqDocument ID)
  if (!rfq && !po) {
    const numericId = parseInt(identifier);
    if (!isNaN(numericId)) {
      rfq = await db.query.rfqDocuments.findFirst({
        where: eq(rfqDocuments.id, numericId),
      });
    }
  }

  // Nothing found
  if (!rfq && !po) {
    return null;
  }

  // Build the full workflow record
  return buildWorkflowRecord(rfq, po);
}

/**
 * Get all workflows, optionally filtered by status
 */
export async function listWorkflows(options?: {
  status?: WorkflowStatus;
  limit?: number;
  offset?: number;
}): Promise<WorkflowRecord[]> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  // Get all RFQs
  const rfqs = await db
    .select()
    .from(rfqDocuments)
    .orderBy(desc(rfqDocuments.createdAt))
    .limit(limit)
    .offset(offset);

  // Get all POs that don't have any RFQ link (and no legacy rfqDocumentId)
  const orphanPOs = await db
    .select({ po: governmentOrders })
    .from(governmentOrders)
    .leftJoin(
      governmentOrderRfqLinks,
      eq(governmentOrderRfqLinks.governmentOrderId, governmentOrders.id)
    )
    .where(
      and(
        isNull(governmentOrderRfqLinks.id),
        isNull(governmentOrders.rfqDocumentId)
      )
    )
    .orderBy(desc(governmentOrders.createdAt))
    .limit(limit)
    .then(rows => rows.map(r => r.po));

  const workflows: WorkflowRecord[] = [];

  // Build workflow records for RFQs
  for (const rfq of rfqs) {
    const workflow = await buildWorkflowRecord(rfq, null);
    if (workflow) {
      if (!options?.status || workflow.status === options.status) {
        workflows.push(workflow);
      }
    }
  }

  // Add orphan POs (POs without linked RFQ)
  for (const po of orphanPOs) {
    const workflow = await buildWorkflowRecord(null, po);
    if (workflow) {
      if (!options?.status || workflow.status === options.status) {
        workflows.push(workflow);
      }
    }
  }

  // Sort by most recent activity
  workflows.sort((a, b) => {
    const aDate = a.poReceivedAt || a.responseSubmittedAt || a.rfqReceivedAt || "";
    const bDate = b.poReceivedAt || b.responseSubmittedAt || b.rfqReceivedAt || "";
    return bDate.localeCompare(aDate);
  });

  return workflows.slice(0, limit);
}

/**
 * Build a complete workflow record from RFQ and/or PO
 * Now supports true many-to-many relationships
 */
async function buildWorkflowRecord(
  rfq: typeof rfqDocuments.$inferSelect | null | undefined,
  po: typeof governmentOrders.$inferSelect | null | undefined
): Promise<WorkflowRecord | null> {
  // Arrays to store all linked documents
  let linkedPOs: Array<typeof governmentOrders.$inferSelect> = [];
  let linkedRFQs: Array<typeof rfqDocuments.$inferSelect> = [];

  // If we have RFQ, find ALL linked POs (not just one)
  if (rfq) {
    // Get all POs via junction table
    const linkedViaJunction = await db
      .select({ po: governmentOrders })
      .from(governmentOrderRfqLinks)
      .innerJoin(
        governmentOrders,
        eq(governmentOrders.id, governmentOrderRfqLinks.governmentOrderId)
      )
      .where(eq(governmentOrderRfqLinks.rfqDocumentId, rfq.id))
      .orderBy(desc(governmentOrders.createdAt));

    linkedPOs = linkedViaJunction.map(r => r.po);

    // Also check legacy direct FK relationship
    const legacyPOs = await db
      .select()
      .from(governmentOrders)
      .where(eq(governmentOrders.rfqDocumentId, rfq.id));

    // Merge, avoiding duplicates
    const poIds = new Set(linkedPOs.map(p => p.id));
    for (const legacyPo of legacyPOs) {
      if (!poIds.has(legacyPo.id)) {
        linkedPOs.push(legacyPo);
      }
    }

    // Set primary PO to the most recent one
    if (!po && linkedPOs.length > 0) {
      po = linkedPOs[0];
    }
  }

  // If we have PO, find ALL linked RFQs (not just one)
  if (po) {
    // Get all RFQs via junction table
    const linkedViaJunction = await db
      .select({ rfq: rfqDocuments })
      .from(governmentOrderRfqLinks)
      .innerJoin(
        rfqDocuments,
        eq(rfqDocuments.id, governmentOrderRfqLinks.rfqDocumentId)
      )
      .where(eq(governmentOrderRfqLinks.governmentOrderId, po.id))
      .orderBy(desc(rfqDocuments.createdAt));

    linkedRFQs = linkedViaJunction.map(r => r.rfq);

    // Also check legacy direct FK relationship
    if (po.rfqDocumentId) {
      const legacyRfq = await db.query.rfqDocuments.findFirst({
        where: eq(rfqDocuments.id, po.rfqDocumentId),
      });
      if (legacyRfq) {
        const rfqIds = new Set(linkedRFQs.map(r => r.id));
        if (!rfqIds.has(legacyRfq.id)) {
          linkedRFQs.push(legacyRfq);
        }
      }
    }

    // Set primary RFQ to the most recent one
    if (!rfq && linkedRFQs.length > 0) {
      rfq = linkedRFQs[0];
    }
  }

  // Get response if we have RFQ
  let response = null;
  if (rfq) {
    response = await db.query.rfqResponses.findFirst({
      where: eq(rfqResponses.rfqDocumentId, rfq.id),
    });
  }

  // Get quality sheet and labels if we have PO
  let qualitySheet = null;
  let labels: Array<typeof generatedLabels.$inferSelect> = [];
  if (po) {
    qualitySheet = await db.query.qualitySheets.findFirst({
      where: eq(qualitySheets.orderId, po.id),
    });
    labels = await db
      .select()
      .from(generatedLabels)
      .where(eq(generatedLabels.orderId, po.id));
  }

  // Compute status
  const { status, label } = computeWorkflowStatus(
    rfq ? { status: rfq.status || "uploaded", dueDate: rfq.dueDate } : null,
    response ? { status: response.status || "draft", submittedAt: response.submittedAt, responseData: response.responseData } : null,
    po ? { status: po.status || "pending" } : null
  );

  return {
    rfqNumber: rfq?.rfqNumber || po?.rfqNumber || null,
    poNumber: po?.poNumber || null,
    status,
    statusLabel: label,

    rfq: rfq ? {
      id: rfq.id,
      fileName: rfq.fileName,
      s3Url: rfq.s3Url,
      rfqNumber: rfq.rfqNumber,
      dueDate: rfq.dueDate?.toISOString() || null,
      contractingOffice: rfq.contractingOffice,
      extractedFields: rfq.extractedFields,
      status: rfq.status || "uploaded",
      createdAt: rfq.createdAt?.toISOString() || new Date().toISOString(),
    } : null,

    response: response ? {
      id: response.id,
      status: response.status || "draft",
      generatedPdfUrl: response.generatedPdfUrl,
      generatedBrandedQuoteUrl: response.generatedBrandedQuoteUrl,
      vendorQuoteRef: response.vendorQuoteRef,
      quoteValidUntil: response.quoteValidUntil?.toISOString() || null,
      submittedAt: response.submittedAt?.toISOString() || null,
      responseData: response.responseData,
      createdAt: response.createdAt?.toISOString() || new Date().toISOString(),
    } : null,

    po: po ? {
      id: po.id,
      poNumber: po.poNumber,
      rfqNumber: po.rfqNumber,
      productName: po.productName,
      nsn: po.nsn,
      quantity: po.quantity,
      unitPrice: po.unitPrice,
      totalPrice: po.totalPrice,
      shipToName: po.shipToName,
      shipToAddress: po.shipToAddress,
      deliveryDate: po.deliveryDate?.toISOString() || null,
      status: po.status || "pending",
      extractedData: po.extractedData,
      createdAt: po.createdAt?.toISOString() || new Date().toISOString(),
    } : null,

    qualitySheet: qualitySheet ? {
      id: qualitySheet.id,
      lotNumber: qualitySheet.lotNumber,
      poNumber: qualitySheet.poNumber,
      quantity: qualitySheet.quantity,
      verifiedBy: qualitySheet.verifiedBy,
      verifiedAt: qualitySheet.verifiedAt?.toISOString() || null,
      createdAt: qualitySheet.createdAt?.toISOString() || new Date().toISOString(),
    } : null,

    labels: labels.map(l => ({
      id: l.id,
      labelType: l.labelType,
      labelSize: l.labelSize,
      pdfUrl: l.pdfUrl,
      createdAt: l.createdAt?.toISOString() || new Date().toISOString(),
    })),

    // Many-to-many: All linked POs
    linkedPOs: linkedPOs.map(p => ({
      id: p.id,
      poNumber: p.poNumber,
      rfqNumber: p.rfqNumber,
      productName: p.productName,
      nsn: p.nsn,
      quantity: p.quantity,
      status: p.status || "pending",
      createdAt: p.createdAt?.toISOString() || new Date().toISOString(),
    })),

    // Many-to-many: All linked RFQs
    linkedRFQs: linkedRFQs.map(r => ({
      id: r.id,
      rfqNumber: r.rfqNumber,
      fileName: r.fileName,
      dueDate: r.dueDate?.toISOString() || null,
      status: r.status || "uploaded",
      createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
    })),

    rfqReceivedAt: rfq?.createdAt?.toISOString() || null,
    responseSubmittedAt: response?.submittedAt?.toISOString() || null,
    poReceivedAt: po?.createdAt?.toISOString() || null,
    verifiedAt: qualitySheet?.verifiedAt?.toISOString() || null,
  };
}

/**
 * Get workflow statistics/summary
 */
export async function getWorkflowStats(): Promise<{
  total: number;
  byStatus: Record<WorkflowStatus, number>;
}> {
  const workflows = await listWorkflows({ limit: 1000 });

  const byStatus: Record<WorkflowStatus, number> = {
    rfq_received: 0,
    response_draft: 0,
    response_submitted: 0,
    no_bid: 0,
    expired: 0,
    lost: 0,
    po_received: 0,
    in_fulfillment: 0,
    verified: 0,
    shipped: 0,
  };

  for (const w of workflows) {
    byStatus[w.status]++;
  }

  return {
    total: workflows.length,
    byStatus,
  };
}
