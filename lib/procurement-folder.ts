import { prisma } from "./prisma";

export type ProcurementStageState = "done" | "active" | "pending";

export interface ProcurementDoc {
  id: string;
  status?: string | null;
  prNumber?: string | null;
  rfqNumber?: string | null;
  abstractNumber?: string | null;
  poNumber?: string | null;
  airNumber?: string | null;
  AIRNumber?: string | null;
  totalAmount?: number | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  createdBy?: { name?: string | null } | null;
  quotations?: unknown[];
}

export interface ProcurementAuditLog {
  id: string;
  documentType: string;
  documentId: string;
  action: string;
  notes?: string | null;
  createdAt: string | Date;
  user?: { id: string; name: string; username: string } | null;
}

export interface ProcurementFolderData extends ProcurementDoc {
  purpose: string;
  fiscalYear: number;
  requestType: string;
  officeId?: string | null;
  office?: { id: string; name: string } | null;
  fundSource?: { id: string; name: string } | null;
  requestedBy?: { id: string; name: string } | null;
  lineItems?: unknown[];
  rfqs?: (ProcurementDoc & {
    abstract?: (ProcurementDoc & {
      purchaseOrders?: (ProcurementDoc & {
        acceptances?: ProcurementDoc[];
      })[];
    }) | null;
  })[];
  auditLogs?: ProcurementAuditLog[];
}

export interface ProcurementStage {
  key: string;
  label: string;
  state: ProcurementStageState;
  docs: ProcurementDoc[];
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

  if (!pr) return null;

  const rfqIds = (pr.rfqs || []).map((r) => r.id);
  const abstractIds = (pr.rfqs || []).map((r) => r.abstract?.id).filter(Boolean) as string[];
  const poIds = (pr.rfqs || [])
    .flatMap((r) => r.abstract?.purchaseOrders || [])
    .map((p) => p.id);
  const airIds = (pr.rfqs || [])
    .flatMap((r) => r.abstract?.purchaseOrders || [])
    .flatMap((p) => p.acceptances || [])
    .map((a) => a.id);

  const allDocIds = [pr.id, ...rfqIds, ...abstractIds, ...poIds, ...airIds];

  const auditLogs = await prisma.documentAuditLog.findMany({
    where: { documentId: { in: allDocIds } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      documentType: true,
      documentId: true,
      action: true,
      notes: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true } },
    },
  });

  return {
    ...pr,
    auditLogs,
  };
}

export function deriveStages(pr: ProcurementFolderData | null | undefined): ProcurementStage[] {
  if (!pr) return [];

  const isJob = pr.requestType === "JOB";

  // Stage 1: Purchase Request / Job Request
  const prDone = pr.status !== "DRAFT";

  // Stage 2: RFQ
  const rfqs = pr.rfqs || [];
  const rfqDone = rfqs.some((r) => r.status !== "DRAFT");
  const rfqActive = prDone && !rfqDone;

  // Stage 3: abstract
  const abstracts = rfqs
    .map((r) => r.abstract)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const abstractDone = abstracts.some((a) => a.status !== "DRAFT");
  const abstractActive = rfqDone && !abstractDone;

  // Stage 4: Purchase Order / Job Order
  const pos = abstracts.flatMap((a) => a.purchaseOrders || []);
  const poDone = pos.some((p) => p.status !== "DRAFT");
  const poActive = abstractDone && !poDone;

  // Stage 5: Acceptance (AIR)
  const acceptances = pos.flatMap((p) => p.acceptances || []);
  const AIRDone = acceptances.some((a) => a.status !== "DRAFT");
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
