import { prisma } from "@/lib/prisma";

export interface RfqCompletionCheckResult {
  isComplete: boolean;
  totalQuotations: number;
  completedQuotations: number;
  status: string;
}

/**
 * Checks and synchronizes the status of an RFQ based on supplier quotations and abstract state.
 * Criteria for completion:
 * - At least 3 supplier quotations exist AND all quotations have positive totalAmount (encoded bid).
 *   OR the linked Abstract of Canvass has progressed to ISSUED, SIGNED, COMPLETED, or APPROVED.
 * 
 * If complete: automatically updates RFQ status to "COMPLETED".
 * If not complete and status was "COMPLETED": reverts RFQ status to "ISSUED".
 */
export async function syncRfqStatus(
  rfqId: string,
  tx?: any
): Promise<RfqCompletionCheckResult | null> {
  const db = tx || prisma;

  const rfq = await db.rfq.findUnique({
    where: { id: rfqId },
    include: {
      quotations: {
        select: { id: true, totalAmount: true }
      },
      abstract: {
        select: { status: true }
      }
    }
  });

  if (!rfq) return null;

  const quotations = rfq.quotations || [];
  const totalQuotations = quotations.length;
  const completedQuotations = quotations.filter((q: any) => (q.totalAmount || 0) > 0).length;

  const quotationsComplete = totalQuotations >= 3 && quotations.every((q: any) => (q.totalAmount || 0) > 0);
  const abstractAdvanced = rfq.abstract && ["ISSUED", "SIGNED", "COMPLETED", "APPROVED"].includes(rfq.abstract.status);

  const isComplete = Boolean(quotationsComplete || abstractAdvanced);

  let updatedStatus = rfq.status;

  if (isComplete && rfq.status !== "COMPLETED") {
    await db.rfq.update({
      where: { id: rfqId },
      data: { status: "COMPLETED" }
    });
    updatedStatus = "COMPLETED";
  } else if (!isComplete && rfq.status === "COMPLETED") {
    await db.rfq.update({
      where: { id: rfqId },
      data: { status: "ISSUED" }
    });
    updatedStatus = "ISSUED";
  }

  return {
    isComplete,
    totalQuotations,
    completedQuotations,
    status: updatedStatus
  };
}

/**
 * Syncs all RFQs in the database to ensure their status accurately reflects quotation/abstract progress.
 */
export async function syncAllRfqs(): Promise<void> {
  const rfqs = await prisma.rfq.findMany({
    include: {
      quotations: {
        select: { id: true, totalAmount: true }
      },
      abstract: {
        select: { status: true }
      }
    }
  });

  for (const rfq of rfqs) {
    const quotations = rfq.quotations || [];
    const totalQuotations = quotations.length;
    const quotationsComplete = totalQuotations >= 3 && quotations.every((q: any) => (q.totalAmount || 0) > 0);
    const abstractAdvanced = rfq.abstract && ["ISSUED", "SIGNED", "COMPLETED", "APPROVED"].includes(rfq.abstract.status);

    const isComplete = Boolean(quotationsComplete || abstractAdvanced);

    if (isComplete && rfq.status !== "COMPLETED") {
      await prisma.rfq.update({
        where: { id: rfq.id },
        data: { status: "COMPLETED" }
      });
    } else if (!isComplete && rfq.status === "COMPLETED") {
      await prisma.rfq.update({
        where: { id: rfq.id },
        data: { status: "ISSUED" }
      });
    }
  }
}

/**
 * Synchronizes an RFQ's line items with its source Purchase Request line items.
 * If new items were added to the PR, they will be copied to the RFQ line items.
 * If quotations already exist, dummy quotationLineItems (price 0) are added so supplier quotes remain valid.
 */
export async function syncRfqItemsWithPr(
  rfqId: string,
  tx?: any
): Promise<boolean> {
  const db = tx || prisma;

  const rfq = await db.rfq.findUnique({
    where: { id: rfqId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      quotations: { select: { id: true } }
    }
  });

  if (!rfq || !rfq.prId) return false;

  const pr = await db.purchaseRequest.findUnique({
    where: { id: rfq.prId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (!pr) return false;

  const prItems = pr.lineItems || [];
  const rfqItems = rfq.lineItems || [];

  // Check if line items are already in sync
  const isIdentical =
    prItems.length === rfqItems.length &&
    prItems.every((pi: any, idx: number) => {
      const ri = rfqItems[idx];
      return (
        ri &&
        ri.description === pi.description &&
        ri.unit === pi.unit &&
        ri.quantity === pi.quantity &&
        ri.unitCost === pi.unitCost &&
        ri.sortOrder === idx
      );
    });

  if (isIdentical) {
    return false;
  }

  const quotations = rfq.quotations || [];

  // When no quotations exist, safely recreate all RFQ line items to match PR exactly
  if (quotations.length === 0) {
    await db.rfqLineItem.deleteMany({ where: { rfqId } });
    for (let idx = 0; idx < prItems.length; idx++) {
      const pi = prItems[idx];
      await db.rfqLineItem.create({
        data: {
          rfqId,
          description: pi.description,
          unit: pi.unit,
          quantity: pi.quantity,
          unitCost: pi.unitCost,
          totalCost: pi.totalCost,
          sortOrder: idx,
        }
      });
    }
    return true;
  }

  // When quotations exist, update existing line items and create new ones
  for (let idx = 0; idx < prItems.length; idx++) {
    const pi = prItems[idx];
    if (idx < rfqItems.length) {
      await db.rfqLineItem.update({
        where: { id: rfqItems[idx].id },
        data: {
          description: pi.description,
          unit: pi.unit,
          quantity: pi.quantity,
          unitCost: pi.unitCost,
          totalCost: pi.totalCost,
          sortOrder: idx,
        }
      });
    } else {
      const newItem = await db.rfqLineItem.create({
        data: {
          rfqId,
          description: pi.description,
          unit: pi.unit,
          quantity: pi.quantity,
          unitCost: pi.unitCost,
          totalCost: pi.totalCost,
          sortOrder: idx,
        }
      });

      for (const q of quotations) {
        await db.quotationLineItem.create({
          data: {
            quotationId: q.id,
            rfqLineItemId: newItem.id,
            unitPrice: 0,
            totalPrice: 0,
          }
        });
      }
    }
  }

  // If PR has fewer items than RFQ, remove the extra items
  if (rfqItems.length > prItems.length) {
    const extraItems = rfqItems.slice(prItems.length);
    const extraIds = extraItems.map((item: any) => item.id);

    await db.quotationLineItem.deleteMany({
      where: { rfqLineItemId: { in: extraIds } }
    });

    await db.rfqLineItem.deleteMany({
      where: { id: { in: extraIds } }
    });
  }

  return true;
}

/**
 * Synchronizes all RFQs linked to a Purchase Request with the PR's line items.
 */
export async function syncAllRfqsForPr(
  prId: string,
  tx?: any
): Promise<void> {
  const db = tx || prisma;
  const rfqs = await db.rfq.findMany({
    where: { prId },
    select: { id: true }
  });

  for (const rfq of rfqs) {
    await syncRfqItemsWithPr(rfq.id, db);
  }
}
