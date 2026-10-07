import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getCurrentFiscalYear } from "@/lib/utils";
import ArchivesClient from "@/components/archives/archives-client";

export default async function ArchivesPage(props: { searchParams: Promise<{ year?: string }> }) {
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
          status: true,
          rfqs: {
            select: {
              aoq: {
                select: {
                  purchaseOrders: {
                    select: {
                      acceptances: { select: { status: true } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  // Calculate stats for each office
  const archives = offices.map(office => {
    const prs = office.purchaseRequests;
    const count = prs.length;

    // Rough estimation of "finished" (has an acceptance/IAR that is not DRAFT)
    let finishedCount = 0;
    for (const pr of prs) {
      let isFinished = false;
      const rfqs = pr.rfqs || [];
      const aoqs = rfqs.map((r: any) => r.aoq).filter(Boolean);
      const pos = aoqs.flatMap((a: any) => a.purchaseOrders || []);
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
      activeCount: count - finishedCount
    };
  });

  const currentYear = getCurrentFiscalYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <ArchivesClient 
      archives={archives} 
      fiscalYear={fiscalYear} 
      availableYears={availableYears} 
    />
  );
}
