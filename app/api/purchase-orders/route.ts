import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
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
        aoq: {
          include: {
            rfq: {
              include: {
                pr: {
                  select: { purpose: true, office: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(pos);
  } catch (error) {
    console.error("Fetch POs Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
