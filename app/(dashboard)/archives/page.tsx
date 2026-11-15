import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getCurrentFiscalYear } from "@/lib/utils";
import { ArchivesPage as ArchivesPageComponent } from "@/components/archives/archives-page";
import { RecentlyOpenedItem } from "@/components/archives/types";
import { getLivePreviewUrl } from "@/lib/recently-opened";

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

  // Fetch recent documents for initial SSR (up to 20 items)
  let initialRecentlyOpened: RecentlyOpenedItem[] = [];
  try {
    const itemsMap = new Map<string, RecentlyOpenedItem>();

    const recentLogs = await prisma.documentAuditLog.findMany({
      where: {
        userId: session.user?.id,
        action: { in: ["OPENED", "SAVE", "UPDATE", "CREATE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    for (const log of recentLogs) {
      if (itemsMap.has(log.documentId)) continue;
      let meta: any = {};
      try {
        if (log.metadata) meta = JSON.parse(log.metadata);
      } catch {}

      const docType = log.documentType === "PURCHASE_REQUEST" ? "PR"
        : log.documentType === "PURCHASE_ORDER" ? "PO"
        : log.documentType;

      itemsMap.set(log.documentId, {
        id: log.id,
        documentId: log.documentId,
        documentType: (docType as any) || "PR",
        title: meta.title || `${docType} Document`,
        officeName: meta.officeName || "Procurement Office",
        openedAt: log.createdAt.toISOString(),
        url: getLivePreviewUrl(docType, log.documentId),
      });

      if (itemsMap.size >= 20) break;
    }

    if (itemsMap.size < 20) {
      const prs = await prisma.purchaseRequest.findMany({
        take: 20 - itemsMap.size,
        orderBy: { updatedAt: "desc" },
        include: { office: true },
      });

      for (const pr of prs) {
        if (!itemsMap.has(pr.id)) {
          itemsMap.set(pr.id, {
            id: pr.id,
            documentId: pr.id,
            documentType: "PR",
            title: pr.purpose ? (pr.purpose.length > 50 ? `${pr.purpose.slice(0, 47)}...` : pr.purpose) : `PR #${pr.prNumber || "Draft"}`,
            officeName: pr.office?.name || "Procurement Office",
            openedAt: pr.updatedAt.toISOString(),
            url: getLivePreviewUrl("PR", pr.id),
          });
        }
      }
    }

    initialRecentlyOpened = Array.from(itemsMap.values()).slice(0, 20);
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
