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
      { rfqNumber: { contains: search } },
      { pr: { purpose: { contains: search } } },
    ];
  }
  if (status) {
    whereClause.status = status;
  }

  try {
    const rfqs = await prisma.rfq.findMany({
      where: whereClause,
      include: {
        pr: {
          select: {
            purpose: true,
            totalAmount: true,
            office: { select: { name: true, code: true } }
          }
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rfqs);
  } catch (error) {
    console.error("Fetch RFQs Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
