import { prisma } from "./prisma";

export type ProcurementStageState = "done" | "active" | "pending";

export interface ProcurementStage {
  key: string;
  label: string;
  state: ProcurementStageState;
  docs: any[];
}

export async function getProcurementFolder(prId: string) {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: {
      office: true,
      fundSource: true,
      requestedBySignatory: true,
      requestedBy: true,
      lineItems: {
        include: { item: true }
      },
      rfqs: {
        include: {
          suppliers: {
            include: { supplier: true }
          },
          quotations: {
            include: { supplier: true, lineItems: true }
          },
          signatory: true,
          aoq: {
            include: {
              lineItems: true,
              purchaseOrders: {
                include: {
                  supplier: true,
                  acceptances: {
                    include: { lineItems: true }
                  },
                  lineItems: true
                }
              }
            }
          }
        }
      }
    }
  });

  return pr;
}

export function deriveStages(pr: any): ProcurementStage[] {
  if (!pr) return [];

  // Stage 1: Purchase Request
  const prDone = pr.status !== "DRAFT";

  // Stage 2: RFQ
  const rfqs = pr.rfqs || [];
  const rfqDone = rfqs.some((r: any) => r.status !== "DRAFT");
  const rfqActive = prDone && !rfqDone;

  // Stage 3: AOQ
  const aoqs = rfqs.map((r: any) => r.aoq).filter(Boolean);
  const aoqDone = aoqs.some((a: any) => a.status !== "DRAFT");
  const aoqActive = rfqDone && !aoqDone;

  // Stage 4: Purchase Order
  const pos = aoqs.flatMap((a: any) => a.purchaseOrders || []);
  const poDone = pos.some((p: any) => p.status !== "DRAFT");
  const poActive = aoqDone && !poDone;

  // Stage 5: Acceptance (IAR)
  const acceptances = pos.flatMap((p: any) => p.acceptances || []);
  const iarDone = acceptances.some((a: any) => a.status !== "DRAFT");
  const iarActive = poDone && !iarDone;

  return [
    {
      key: "PR",
      label: "Purchase Request",
      state: prDone ? "done" : "active",
      docs: [pr]
    },
    {
      key: "RFQ",
      label: "Request for Quotation",
      state: rfqDone ? "done" : (rfqActive ? "active" : "pending"),
      docs: rfqs
    },
    {
      key: "AOQ",
      label: "Abstract of Canvass",
      state: aoqDone ? "done" : (aoqActive ? "active" : "pending"),
      docs: aoqs
    },
    {
      key: "PO",
      label: "Purchase Order",
      state: poDone ? "done" : (poActive ? "active" : "pending"),
      docs: pos
    },
    {
      key: "IAR",
      label: "Inspection & Acceptance",
      state: iarDone ? "done" : (iarActive ? "active" : "pending"),
      docs: acceptances
    }
  ];
}
