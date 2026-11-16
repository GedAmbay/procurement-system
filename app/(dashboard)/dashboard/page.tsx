import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/dashboard/dashboard-client";

async function getDashboardData() {
  const [
    totalPrs,
    rfqForSigning,
    abstractForSigning,
    poForSigning,
    pipelineCounts,
    posForSavingsAndAvgTime,
    nextAwardEvent,
    bacSignatories,
    thisMonthPrs,
  ] = await Promise.all([
    prisma.purchaseRequest.count(),
    prisma.rfq.count({ where: { status: "FOR_SIGNING", pr: { isDirectAcquisition: false } } }),
    prisma.abstractOfCanvass.count({ where: { status: "FOR_SIGNING", rfq: { pr: { isDirectAcquisition: false } } } }),
    prisma.purchaseOrder.count({ where: { status: "FOR_SIGNING" } }),
    Promise.all([
      prisma.purchaseRequest.count(), // PR Logged
      prisma.rfq.count(), // RFQ
      prisma.abstractOfCanvass.count(), // Abstract
      prisma.abstractOfCanvass.count({ where: { status: { in: ["FOR_SIGNING", "COMPLETED"] } } }), // Abstract / Award
      prisma.purchaseOrder.count(), // PO
      prisma.acceptance.count(), // Acceptance
      prisma.purchaseOrder.count({ where: { status: { in: ["ISSUED", "COMPLETED"] } } }), // Issued
    ]),
    prisma.purchaseOrder.findMany({
      where: { fiscalYear: new Date().getFullYear(), status: { in: ["ISSUED", "COMPLETED"] } },
      select: {
        totalAmount: true,
        createdAt: true,
        pr: { select: { totalAmount: true, createdAt: true } },
        abstract: { select: { rfq: { select: { pr: { select: { totalAmount: true, createdAt: true } } } } } },
      },
    }),
    prisma.calendarEvent.findFirst({
      where: {
        eventType: "Award Date",
        eventDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      orderBy: { eventDate: "asc" },
      select: { eventDate: true, title: true, pr: { select: { prNumber: true } } },
    }),
    prisma.signatory.findMany({
      where: {
        role: { in: ["BAC_CHAIRMAN", "BAC_VICE_CHAIRMAN", "BAC_MEMBER"] },
        isActive: true,
      },
      orderBy: { role: "asc" },
      select: { id: true, name: true, position: true, role: true },
    }),
    prisma.purchaseRequest.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  // Calculate Savings & Avg Time
  let totalSavings = 0;
  let totalDays = 0;
  let validProcessingCount = 0;

  posForSavingsAndAvgTime.forEach((po) => {
    const pr = po.pr || po.abstract?.rfq?.pr;
    if (pr) {
      if (pr.totalAmount > po.totalAmount) {
        totalSavings += pr.totalAmount - po.totalAmount;
      }
      const prDate = new Date(pr.createdAt).getTime();
      const poDate = new Date(po.createdAt).getTime();
      const diffDays = (poDate - prDate) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0) {
        totalDays += diffDays;
        validProcessingCount++;
      }
    }
  });

  const avgProcessingDays = validProcessingCount > 0 ? Math.round(totalDays / validProcessingCount) : 0;

  return {
    stats: {
      totalPrs,
      rfqForSigning,
      abstractForSigning,
      poForSigning,
      thisMonthPrs,
    },
    kpis: {
      totalSavings,
      avgProcessingDays,
      nextAwardEvent,
    },
    pipeline: {
      logged: pipelineCounts[0],
      rfq: pipelineCounts[1],
      abstract: pipelineCounts[2],
      abstractAward: pipelineCounts[3],
      po: pipelineCounts[4],
      acceptance: pipelineCounts[5],
      issued: pipelineCounts[6],
    },
    bacSignatories,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const data = await getDashboardData();

  return <DashboardClient data={data} user={session?.user as any} />;
}
