import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import DashboardClient from "@/components/dashboard/dashboard-client";
import { formatCurrency } from "@/lib/utils";

type MonthlyPR = { createdAt: Date; totalAmount: number; status: string };


async function getDashboardData() {
  const [
    prDraft,
    prSubmitted,
    prApproved,
    prForRfq,
    rfqCount,
    poForSig,
    poReleased,
    recentPRs,
    monthlyData,
    fundSources,
  ] = await Promise.all([
    prisma.purchaseRequest.count({ where: { status: "DRAFT" } }),
    prisma.purchaseRequest.count({ where: { status: "SUBMITTED" } }),
    prisma.purchaseRequest.count({ where: { status: "APPROVED" } }),
    prisma.purchaseRequest.count({ where: { status: "FOR_RFQ" } }),
    prisma.rfq.count({ where: { status: "ISSUED" } }),
    prisma.purchaseOrder.count({ where: { status: "FOR_SIGNATURE" } }),
    prisma.purchaseOrder.count({ where: { status: "RELEASED" } }),
    prisma.purchaseRequest.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { office: true, requestedBy: true },
    }),
    // Monthly PR counts for the current year (simplified)
    prisma.purchaseRequest.findMany({
      where: { fiscalYear: new Date().getFullYear() },
      select: { createdAt: true, totalAmount: true, status: true },
    }),
    prisma.fundSource.findMany({
      where: { isActive: true, fiscalYear: new Date().getFullYear() },
      take: 5,
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

  return {
    stats: {
      prPending: prSubmitted + prApproved,
      rfqActive: rfqCount,
      poForSig,
      poReleased,
      prDraft,
      prForRfq,
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
    fundSources: fundSources.map((f: typeof fundSources[number]) => ({
      name: f.name,
      total: f.totalBudget,
      used: f.usedBudget,
      available: f.totalBudget - f.usedBudget,
    })),
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const data = await getDashboardData();

  return <DashboardClient data={data} user={session?.user as any} />;
}
