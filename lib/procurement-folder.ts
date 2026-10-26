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
          createdBy: true,
          suppliers: {
            include: { supplier: true }
          },
          quotations: {
            include: { supplier: true, lineItems: true }
          },
          signatory: true,
          abstract: {
            include: {
              createdBy: true,
              lineItems: true,
              purchaseOrders: {
                include: {
                  createdBy: true,
                  supplier: true,
                  acceptances: {
                    include: { lineItems: true, createdBy: true }
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

  const isJob = pr.requestType === "JOB";

  // Stage 1: Purchase Request / Job Request
  const prDone = pr.status !== "DRAFT";

  // Stage 2: RFQ
  const rfqs = pr.rfqs || [];
  const rfqDone = rfqs.some((r: any) => r.status !== "DRAFT");
  const rfqActive = prDone && !rfqDone;

  // Stage 3: abstract
  const abstracts = rfqs.map((r: any) => r.abstract).filter(Boolean);
  const abstractDone = abstracts.some((a: any) => a.status !== "DRAFT");
  const abstractActive = rfqDone && !abstractDone;

  // Stage 4: Purchase Order / Job Order
  const pos = abstracts.flatMap((a: any) => a.purchaseOrders || []);
  const poDone = pos.some((p: any) => p.status !== "DRAFT");
  const poActive = abstractDone && !poDone;

  // Stage 5: Acceptance (AIR)
  const acceptances = pos.flatMap((p: any) => p.acceptances || []);
  const AIRDone = acceptances.some((a: any) => a.status !== "DRAFT");
  const AIRActive = poDone && !AIRDone;

  return [
    {
      key: isJob ? "JR" : "PR",
      label: isJob ? "Job Request" : "Purchase Request",
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
      key: "Abstract",
      label: "Abstract of Canvass",
      state: abstractDone ? "done" : (abstractActive ? "active" : "pending"),
      docs: abstracts
    },
    {
      key: isJob ? "JO" : "PO",
      label: isJob ? "Job Order" : "Purchase Order",
      state: poDone ? "done" : (poActive ? "active" : "pending"),
      docs: pos
    },
    {
      key: "AIR",
      label: "Acceptance & Inspection",
      state: AIRDone ? "done" : (AIRActive ? "active" : "pending"),
      docs: acceptances
    }
  ];
}
