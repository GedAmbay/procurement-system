import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getCurrentFiscalYear } from "@/lib/utils";
import { ArchivesPage as ArchivesPageComponent } from "@/components/archives/archives-page";
import { RecentlyOpenedItem } from "@/components/archives/types";

export default async function ArchivesPage(props: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session) return null;

  const searchParams = await props.searchParams;
  const yearStr = searchParams.year;
  const parsedYear = yearStr && yearStr !== "null" ? parseInt(yearStr, 10) : NaN;
  const fiscalYear = isNaN(parsedYear) ? getCurrentFiscalYear() : parsedYear;

  // Get all active offices
  const offices = await prisma.office.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      purchaseRequests: {
        where: { fiscalYear },
        select: {
          id: true,
          totalAmount: true,
          updatedAt: true,
          rfqs: {
            select: {
              abstract: {
                select: {
                  purchaseOrders: {
                    select: {
                      acceptances: { select: { status: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Calculate stats for each office
  const archives = offices.map((office) => {
    const prs = office.purchaseRequests;
    const count = prs.length;

    let finishedCount = 0;
    for (const pr of prs) {
      let isFinished = false;
      const rfqs = pr.rfqs || [];
      const abstracts = rfqs.map((r: any) => r.abstract).filter(Boolean);
      const pos = abstracts.flatMap((a: any) => a.purchaseOrders || []);
      const acceptances = pos.flatMap((p: any) => p.acceptances || []);
      if (acceptances.some((a: any) => a.status !== "DRAFT")) {
        isFinished = true;
      }
      if (isFinished) {
        finishedCount++;
      }
    }

    return {
      id: office.id,
      name: office.name,
      code: office.code,
      head: office.head,
      count,
      finishedCount,
      activeCount: count - finishedCount,
    };
  });

  const currentYear = getCurrentFiscalYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Fetch recent documents for initial SSR
  let initialRecentlyOpened: RecentlyOpenedItem[] = [];
  try {
    const recentLogs = await prisma.documentAuditLog.findMany({
      where: {
        userId: session.user?.id,
        action: "OPENED",
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    if (recentLogs.length > 0) {
      initialRecentlyOpened = recentLogs.map((log) => {
        let meta: any = {};
        try {
          if (log.metadata) meta = JSON.parse(log.metadata);
        } catch {}
        return {
          id: log.id,
          documentId: log.documentId,
          documentType: (log.documentType as any) || "PR",
          title: meta.title || `${log.documentType} Document`,
          officeName: meta.officeName || "Procurement Office",
          openedAt: log.createdAt.toISOString(),
          url: meta.url || `/${log.documentType.toLowerCase()}s/${log.documentId}`,
        };
      });
    }
  } catch {
    // Graceful fallback to client localStorage
  }

  return (
    <ArchivesPageComponent
      archives={archives}
      fiscalYear={fiscalYear}
      availableYears={availableYears}
      initialRecentlyOpened={initialRecentlyOpened}
    />
  );
}
