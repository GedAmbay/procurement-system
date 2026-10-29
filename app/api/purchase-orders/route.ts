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
    const pos = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
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
      orderBy: { createdAt: "desc" },
    });

    // Auto-heal / sync any PO missing supplier if abstract has bids
    const posToSync = pos.filter((p: any) => !p.supplierId && p.abstractId);
    if (posToSync.length > 0) {
      await Promise.all(posToSync.map((p: any) => syncAwardedSupplierToPO(p.abstractId)));
      const refreshedPos = await prisma.purchaseOrder.findMany({
        where: whereClause,
        include: {
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
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(refreshedPos);
    }

    return NextResponse.json(pos);
  } catch (error) {
    console.error("Fetch POs Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
