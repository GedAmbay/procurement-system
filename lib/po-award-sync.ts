import { prisma } from "@/lib/prisma";

export interface AwardSyncResult {
  winnerSupplierId: string;
  supplier: any;
  totalAmount: number;
}

/**
 * Automatically synchronizes the winning (lowest valid bid) supplier from the Abstract of Canvass
 * to the linked Purchase Order(s) and their line item unit/total prices.
 */
export async function syncAwardedSupplierToPO(
  abstractId: string,
  tx?: any
): Promise<AwardSyncResult | null> {
  const db = tx || prisma;

  try {
    const abstract = await db.abstractOfCanvass.findUnique({
      where: { id: abstractId },
      include: {
        rfq: {
          include: {
            lineItems: { orderBy: { sortOrder: "asc" } },
            quotations: {
              include: {
                supplier: true,
                lineItems: {
                  include: {
                    rfqLineItem: true,
                  }
                }
              }
            }
          }
        },
        purchaseOrders: {
          include: {
            lineItems: { orderBy: { sortOrder: "asc" } }
          }
        }
      }
    });

    if (!abstract || !abstract.rfq?.quotations?.length) return null;

    // Filter valid bids that have been encoded with amounts > 0
    const validBids = abstract.rfq.quotations.filter((q: any) => (q.totalAmount || 0) > 0);
    if (validBids.length === 0) return null;

    // Find the lowest valid bid (recommended winner according to standard LGU procurement rules)
    const lowestBid = validBids.reduce((prev: any, curr: any) =>
      (prev.totalAmount < curr.totalAmount ? prev : curr)
    );

    if (!lowestBid || !lowestBid.supplierId) return null;

    // Update Abstract total amount if it differs from the winning bid
    if (abstract.totalAmount !== lowestBid.totalAmount) {
      await db.abstractOfCanvass.update({
        where: { id: abstractId },
        data: { totalAmount: lowestBid.totalAmount }
      });
    }

    // Update all linked Purchase Orders
    const pos = abstract.purchaseOrders || [];
    for (const po of pos) {
      // Automatically set supplier & totalAmount if not set or still in DRAFT
      if (!po.supplierId || po.status === "DRAFT") {
        await db.purchaseOrder.update({
          where: { id: po.id },
          data: {
            supplierId: lowestBid.supplierId,
            totalAmount: lowestBid.totalAmount,
          }
        });

        // Update line items pricing from the winning quotation
        for (const poLine of po.lineItems) {
          const quoteLine = lowestBid.lineItems.find(
            (qli: any) =>
              qli.rfqLineItemId === poLine.id ||
              qli.rfqLineItem?.sortOrder === poLine.sortOrder ||
              qli.rfqLineItem?.description?.trim().toLowerCase() === poLine.description?.trim().toLowerCase()
          );

          if (quoteLine && (quoteLine.unitPrice > 0 || quoteLine.totalPrice > 0)) {
            await db.poLineItem.update({
              where: { id: poLine.id },
              data: {
                unitPrice: quoteLine.unitPrice,
                totalPrice: quoteLine.totalPrice,
              }
            });
          }
        }
      }
    }

    return {
      winnerSupplierId: lowestBid.supplierId,
      supplier: lowestBid.supplier,
      totalAmount: lowestBid.totalAmount,
    };
  } catch (err) {
    console.error("syncAwardedSupplierToPO error:", err);
    return null;
  }
}

/**
 * Convenience helper to sync awarded supplier using an RFQ ID.
 */
export async function syncAwardedSupplierByRfq(
  rfqId: string,
  tx?: any
): Promise<AwardSyncResult | null> {
  const db = tx || prisma;
  try {
    const abstract = await db.abstractOfCanvass.findFirst({
      where: { rfqId }
    });
    if (!abstract) return null;
    return await syncAwardedSupplierToPO(abstract.id, tx);
  } catch (err) {
    console.error("syncAwardedSupplierByRfq error:", err);
    return null;
  }
}
