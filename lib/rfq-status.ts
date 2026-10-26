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
