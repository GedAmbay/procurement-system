import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import DashboardClient from "@/components/dashboard/dashboard-client";
import { formatCurrency } from "@/lib/utils";

type MonthlyPR = { createdAt: Date; totalAmount: number; status: string };


async function getDashboardData() {
  const [
    totalPrs,
    rfqForSigning,
    aoqForSigning,
    poForSigning,
    recentPRs,
    monthlyData,
    overdueDeliveries,
    pipelineCounts,
    posForSavingsAndAvgTime,
    nextAwardEvent,
  ] = await Promise.all([
    prisma.purchaseRequest.count(),
    prisma.rfq.count({ where: { status: "FOR_SIGNING", pr: { isDirectAcquisition: false } } }),
    prisma.abstractOfQuotation.count({ where: { status: "FOR_SIGNING", rfq: { pr: { isDirectAcquisition: false } } } }),
    prisma.purchaseOrder.count({ where: { status: "FOR_SIGNING" } }),
    prisma.purchaseRequest.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { office: true, requestedBy: true },
    }),
    prisma.purchaseRequest.findMany({
      where: { fiscalYear: new Date().getFullYear() },
      select: { createdAt: true, totalAmount: true, status: true },
    }),
    prisma.purchaseOrder.count({
      where: { status: "ISSUED", deliveryDate: { lt: new Date() } }
    }),
    Promise.all([
      prisma.purchaseRequest.count({ where: { status: { in: ["SUBMITTED", "APPROVED"] } } }), // PR Logged
      prisma.purchaseRequest.count({ where: { status: "FOR_RFQ", isDirectAcquisition: false } }), // For RFQ
      prisma.purchaseRequest.count({ where: { status: "FOR_AOQ", isDirectAcquisition: false } }), // For AOQ
      prisma.purchaseRequest.count({ where: { status: "FOR_PO" } }), // For PO
      prisma.purchaseOrder.count({ where: { status: { in: ["ISSUED", "COMPLETED"] } } }) // Issued
    ]),
      prisma.purchaseOrder.findMany({
      where: { fiscalYear: new Date().getFullYear(), status: { in: ["ISSUED", "COMPLETED"] } },
      select: {
        totalAmount: true,
        createdAt: true,
        pr: { select: { totalAmount: true, createdAt: true } },
        aoq: { select: { rfq: { select: { pr: { select: { totalAmount: true, createdAt: true } } } } } }
      }
    }),
    prisma.calendarEvent.findFirst({
      where: {
        eventType: "Award Date",
        eventDate: { gte: new Date(new Date().setHours(0,0,0,0)) }
      },
      orderBy: { eventDate: "asc" },
      select: { eventDate: true, title: true, pr: { select: { prNumber: true } } }
    }),
  ]);

  // Build monthly chart data
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyChart = months.map((month, i) => {
    const prs = monthlyData.filter((pr: MonthlyPR) => new Date(pr.createdAt).getMonth() === i);
    return {
      month,
      count: prs.length,
      amount: prs.reduce((sum: number, pr: MonthlyPR) => sum + pr.totalAmount, 0),
    };
  });

  // Calculate KPIs
  let totalSavings = 0;
  let totalDays = 0;
  let validProcessingCount = 0;

  posForSavingsAndAvgTime.forEach(po => {
    const pr = po.pr || po.aoq?.rfq?.pr;
    if (pr) {
      // Savings
      if (pr.totalAmount > po.totalAmount) {
        totalSavings += (pr.totalAmount - po.totalAmount);
      }
      
      // Processing Time
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
      aoqForSigning,
      poForSigning,
      overdueDeliveries,
    },
    kpis: {
      totalSavings,
      avgProcessingDays,
      nextAwardEvent,
    },
    pipeline: {
      logged: pipelineCounts[0],
      forRfq: pipelineCounts[1],
      forAoq: pipelineCounts[2],
      forPo: pipelineCounts[3],
      issued: pipelineCounts[4],
    },
    recentPRs: recentPRs.map((pr: typeof recentPRs[number]) => ({
      id: pr.id,
      prNumber: pr.prNumber,
      office: pr.office.name,
      purpose: pr.purpose,
      totalAmount: pr.totalAmount,
      status: pr.status,
      createdAt: pr.createdAt.toISOString(),
    })),
    monthlyChart,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const data = await getDashboardData();

  return <DashboardClient data={data} user={session?.user as any} />;
}
