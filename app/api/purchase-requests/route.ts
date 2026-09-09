import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Function to generate the next PR Number in YY-MM-XXXX format
async function generatePRNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${yy}-${mm}-`;

  // Find the highest PR number for the current month
  const lastPR = await prisma.purchaseRequest.findFirst({
    where: { prNumber: { startsWith: prefix } },
    orderBy: { prNumber: "desc" },
  });

  let sequence = 1;
  if (lastPR) {
    const lastSequence = parseInt(lastPR.prNumber.split("-")[2], 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  const sequenceStr = String(sequence).padStart(4, "0");
  return `${prefix}${sequenceStr}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  
  const user = session.user as any;
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { prNumber: { contains: search } },
      { purpose: { contains: search } },
    ];
  }
  if (status) {
    whereClause.status = status;
  }
  
  // If End User, only show their office's PRs
  if (user.role === "END_USER" && user.officeId) {
    whereClause.officeId = user.officeId;
  }

  const prs = await prisma.purchaseRequest.findMany({
    where: whereClause,
    include: {
      office: { select: { name: true, code: true } },
      requestedBy: { select: { name: true } },
      fundSource: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(prs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  try {
    const body = await req.json();
    const { officeId, purpose, fundSourceId, chargeToAccount, lineItems } = body;

    const prNumber = await generatePRNumber();
    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0);
    const fiscalYear = new Date().getFullYear();

    const pr = await prisma.purchaseRequest.create({
      data: {
        prNumber,
        officeId,
        requestedById: user.id,
        purpose,
        fundSourceId: fundSourceId || null,
        chargeToAccount,
        totalAmount,
        fiscalYear,
        status: "DRAFT",
        lineItems: {
          create: lineItems.map((item: any, idx: number) => ({
            itemId: item.itemId || null,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
            sortOrder: idx,
          })),
        },
      },
      include: { lineItems: true },
    });

    return NextResponse.json(pr, { status: 201 });
  } catch (error: any) {
    console.error("PR Creation Error:", error);
    return NextResponse.json({ error: "Failed to create Purchase Request" }, { status: 500 });
  }
}
