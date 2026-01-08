import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { governmentOrders, rfqDocuments, rfqResponses, governmentOrderRfqLinks } from "@/drizzle/migrations/schema";
import { eq } from "drizzle-orm";

interface Discrepancy {
  field: string;
  rfqValue: unknown;
  poValue: unknown;
  severity: "warning" | "error";
  message: string;
}

/**
 * Compare a PO against its original RFQ to catch discrepancies.
 * Boss uses this to verify that the PO matches what was quoted.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = parseInt(id);
  if (isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    // Get the PO
    const [order] = await db
      .select()
      .from(governmentOrders)
      .where(eq(governmentOrders.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Find linked RFQ
    const [link] = await db
      .select()
      .from(governmentOrderRfqLinks)
      .where(eq(governmentOrderRfqLinks.governmentOrderId, orderId))
      .limit(1);

    if (!link) {
      return NextResponse.json({
        order: {
          id: order.id,
          poNumber: order.poNumber,
          productName: order.productName,
          nsn: order.nsn,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
        },
        linkedRfq: null,
        quotedResponse: null,
        comparison: null,
        message: "No linked RFQ found for this PO",
      });
    }

    // Get the RFQ
    const [rfq] = await db
      .select()
      .from(rfqDocuments)
      .where(eq(rfqDocuments.id, link.rfqDocumentId))
      .limit(1);

    // Get the response (quote) we submitted
    const [response] = await db
      .select()
      .from(rfqResponses)
      .where(eq(rfqResponses.rfqDocumentId, link.rfqDocumentId))
      .limit(1);

    if (!rfq) {
      return NextResponse.json({
        order: {
          id: order.id,
          poNumber: order.poNumber,
          productName: order.productName,
          nsn: order.nsn,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
        },
        linkedRfq: null,
        quotedResponse: null,
        comparison: null,
        message: "Linked RFQ not found in database",
      });
    }

    // Compare fields
    const discrepancies: Discrepancy[] = [];
    const rfqFields = rfq.extractedFields as Record<string, unknown> | null;
    const rfqSummary = rfqFields?.rfqSummary as Record<string, unknown> | undefined;
    const rfqItems = (rfqSummary?.items || rfqFields?.items || []) as Array<Record<string, unknown>>;
    const responseData = response?.responseData as Record<string, unknown> | null;
    const responseLineItems = (responseData?.lineItems || []) as Array<Record<string, unknown>>;

    // Try to find matching RFQ item by NSN
    const poNsn = order.nsn;
    const normalizeNsn = (nsn: string | null | undefined) => nsn?.replace(/-/g, '') || '';

    // Find matching item by NSN or use first item
    let matchingRfqItemIndex = 0;
    if (poNsn) {
      const foundIndex = rfqItems.findIndex(item =>
        normalizeNsn(item.nsn as string) === normalizeNsn(poNsn)
      );
      if (foundIndex >= 0) matchingRfqItemIndex = foundIndex;
    }

    const matchingRfqItem = rfqItems[matchingRfqItemIndex];
    const matchingResponseItem = responseLineItems[matchingRfqItemIndex];

    // Compare total quantity across all items vs PO quantity
    const totalRfqQty = rfqItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const poQty = order.quantity;

    // Compare quantity - check both specific item and total
    const itemQty = matchingRfqItem?.quantity as number | undefined;
    if (itemQty && poQty && itemQty !== poQty) {
      discrepancies.push({
        field: "quantity",
        rfqValue: itemQty,
        poValue: poQty,
        severity: poQty < itemQty ? "warning" : "error",
        message: poQty < itemQty
          ? `PO quantity (${poQty}) is LESS than RFQ line item (${itemQty}) - partial award?`
          : `PO quantity (${poQty}) is MORE than RFQ line item (${itemQty}) - verify!`,
      });
    }

    // Compare unit price (if we quoted)
    const quotedPrice = matchingResponseItem?.unitCost as string | undefined;
    const poPrice = order.unitPrice;
    if (quotedPrice && poPrice) {
      const quotedNum = parseFloat(quotedPrice);
      const poNum = parseFloat(String(poPrice));
      if (Math.abs(quotedNum - poNum) > 0.01) {
        const priceDiff = ((poNum - quotedNum) / quotedNum * 100).toFixed(1);
        discrepancies.push({
          field: "unitPrice",
          rfqValue: quotedPrice,
          poValue: String(poPrice),
          severity: poNum < quotedNum ? "error" : "warning",
          message: poNum < quotedNum
            ? `PO price ($${poPrice}) is ${Math.abs(Number(priceDiff))}% LOWER than quoted ($${quotedPrice}) - reject or verify!`
            : `PO price ($${poPrice}) is ${priceDiff}% higher than quoted ($${quotedPrice})`,
        });
      }
    }

    // Compare NSN
    const rfqNsn = matchingRfqItem?.nsn as string | undefined;
    if (rfqNsn && poNsn && normalizeNsn(rfqNsn) !== normalizeNsn(poNsn)) {
      discrepancies.push({
        field: "nsn",
        rfqValue: rfqNsn,
        poValue: poNsn,
        severity: "error",
        message: `NSN mismatch! RFQ: ${rfqNsn}, PO: ${poNsn}`,
      });
    }

    // Check if PO NSN doesn't match ANY RFQ item
    if (poNsn && rfqItems.length > 0) {
      const anyMatch = rfqItems.some(item => normalizeNsn(item.nsn as string) === normalizeNsn(poNsn));
      if (!anyMatch) {
        discrepancies.push({
          field: "nsn",
          rfqValue: rfqItems.map(i => i.nsn).join(', '),
          poValue: poNsn,
          severity: "error",
          message: `PO NSN (${poNsn}) doesn't match ANY RFQ line item NSNs!`,
        });
      }
    }

    // Compare delivery date (if both have it)
    const rfqDeliveryDate = (rfqSummary?.header as Record<string, unknown> | undefined)?.deliveryBeforeDate as string | undefined;
    const poDeliveryDate = order.deliveryDate;
    if (rfqDeliveryDate && poDeliveryDate) {
      const rfqDate = new Date(rfqDeliveryDate);
      const poDate = new Date(poDeliveryDate);
      const daysDiff = Math.abs(Math.floor((poDate.getTime() - rfqDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysDiff > 0) {
        discrepancies.push({
          field: "deliveryDate",
          rfqValue: rfqDeliveryDate,
          poValue: poDeliveryDate.toISOString().split('T')[0],
          severity: daysDiff > 7 ? "warning" : "warning",
          message: `Delivery date changed by ${daysDiff} days: RFQ (${rfqDeliveryDate}) → PO (${poDeliveryDate.toISOString().split('T')[0]})`,
        });
      }
    }

    // Check for no-bid items that got awarded
    if (matchingResponseItem?.noBidReason) {
      discrepancies.push({
        field: "noBid",
        rfqValue: matchingResponseItem.noBidReason,
        poValue: "awarded",
        severity: "error",
        message: `We marked this as NO-BID (${matchingResponseItem.noBidReason}) but received a PO - verify!`,
      });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        poNumber: order.poNumber,
        productName: order.productName,
        nsn: order.nsn,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
      },
      linkedRfq: {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        fileName: rfq.fileName,
      },
      quotedResponse: responseData ? {
        unitCost: responseLineItems[0]?.unitCost,
        deliveryDays: responseLineItems[0]?.deliveryDays,
      } : null,
      comparison: {
        hasDiscrepancies: discrepancies.length > 0,
        discrepancies,
        errors: discrepancies.filter(d => d.severity === "error").length,
        warnings: discrepancies.filter(d => d.severity === "warning").length,
      },
    });

  } catch (error) {
    console.error("Comparison error:", error);
    return NextResponse.json(
      { error: "Comparison failed", details: String(error) },
      { status: 500 }
    );
  }
}
