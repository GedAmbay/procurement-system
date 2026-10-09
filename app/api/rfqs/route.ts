import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";

  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { rfqNumber: { contains: search } },
      { pr: { purpose: { contains: search } } },
      { pr: { office: { name: { contains: search } } } },
      { pr: { office: { code: { contains: search } } } },
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

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  try {
    const session = await auth();
    const { prId } = await req.json();
    if (!prId) return NextResponse.json({ error: "PR ID is required" }, { status: 400 });

    const existingRfq = await prisma.rfq.findFirst({ where: { prId } });
    if (existingRfq) {
      return NextResponse.json({ error: "An RFQ already exists for this PR" }, { status: 400 });
    }

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      include: { fundSource: true, lineItems: true }
    });

    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    const yy = String(pr.fiscalYear).slice(-2) || String(new Date().getFullYear()).slice(-2);
    const prParts = pr.prNumber.split("-");
    const xxxx = prParts[prParts.length - 1];
    
    let fundPrefix = "GF";
    if (pr.fundSource && pr.fundSource.code.toUpperCase().startsWith("TF")) {
      fundPrefix = "TF";
    }
    const rfqNumber = `${fundPrefix}-${yy}-${xxxx}`;

    const rfq = await prisma.rfq.create({
      data: {
        rfqNumber,
        prId,
        fiscalYear: pr.fiscalYear,
        status: "DRAFT",
        createdById: session?.user?.id,
        lineItems: {
          create: pr.lineItems.map(li => ({
            description: li.description,
            unit: li.unit,
            quantity: li.quantity,
            unitCost: li.unitCost,
            totalCost: li.totalCost,
            sortOrder: li.sortOrder
          }))
        }
      }
    });

    return NextResponse.json(rfq);
  } catch (error) {
    console.error("Create RFQ Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
