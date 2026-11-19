import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";
import { syncAwardedSupplierToPO } from "@/lib/po-award-sync";

export async function GET(req: NextRequest) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";

  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { poNumber: { contains: search } },
      { supplier: { name: { contains: search } } },
    ];
  }

  if (status) {
    whereClause.status = status;
  }

  try {
    let finalPos = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { name: true } },
        supplier: true,
        pr: {
          select: { prNumber: true, purpose: true, office: true, isDirectAcquisition: true, requestType: true } as any
        },
        abstract: {
          include: {
            rfq: {
              include: {
                pr: {
                  select: { prNumber: true, purpose: true, office: true, isDirectAcquisition: true, requestType: true } as any
                },
                quotations: {
                  include: { supplier: true }
                }
              }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" },
    });

    // Auto-heal / sync any PO missing supplier if abstract has bids
    const posToSync = finalPos.filter((p: any) => !p.supplierId && p.abstractId);
    if (posToSync.length > 0) {
      await Promise.all(posToSync.map((p: any) => syncAwardedSupplierToPO(p.abstractId)));
      finalPos = await prisma.purchaseOrder.findMany({
        where: whereClause,
        include: {
          createdBy: { select: { name: true } },
          supplier: true,
          pr: {
            select: { prNumber: true, purpose: true, office: true, isDirectAcquisition: true, requestType: true } as any
          },
          abstract: {
            include: {
              rfq: {
                include: {
                  pr: {
                    select: { prNumber: true, purpose: true, office: true, isDirectAcquisition: true, requestType: true } as any
                  },
                  quotations: {
                    include: { supplier: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    const poIds = finalPos.map((p) => p.id);
    const recentLogs = poIds.length > 0
      ? await prisma.documentAuditLog.findMany({
          where: {
            documentId: { in: poIds },
            action: { in: ["SAVE", "UPDATE", "CREATE"] },
          },
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } } },
        })
      : [];

    const lastLogMap = new Map<string, string>();
    for (const log of recentLogs) {
      if (!lastLogMap.has(log.documentId) && log.user?.name) {
        lastLogMap.set(log.documentId, log.user.name);
      }
    }

    const result = finalPos.map((p) => ({
      ...p,
      lastModifiedBy: lastLogMap.get(p.id) || p.createdBy?.name || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fetch POs Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
