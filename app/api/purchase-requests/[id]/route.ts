import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        office: true,
        requestedBy: { select: { id: true, name: true, role: true } },
        fundSource: true,
        lineItems: { orderBy: { sortOrder: "asc" }, include: { item: true } },
      },
    });

    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    return NextResponse.json(pr);
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    const body = await req.json();

    // Check if it's just a status update
    if (body.status && Object.keys(body).length === 1) {
      // Add status workflow checks here if necessary
      const updatedPR = await prisma.purchaseRequest.update({
        where: { id },
        data: { status: body.status },
      });
      return NextResponse.json(updatedPR);
    }

    // Otherwise, full update (only allowed if DRAFT or REJECTED)
    if (pr.status !== "DRAFT" && pr.status !== "REJECTED") {
      return NextResponse.json({ error: "Cannot edit submitted or approved PR" }, { status: 400 });
    }

    const { officeId, purpose, fundSourceId, chargeToAccount, lineItems } = body;
    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0);

    const updatedPR = await prisma.$transaction(async (tx) => {
      // 1. Delete old line items
      await tx.prLineItem.deleteMany({ where: { prId: id } });

      // 2. Update PR and create new line items
      return await tx.purchaseRequest.update({
        where: { id },
        data: {
          officeId,
          purpose,
          fundSourceId: fundSourceId || null,
          chargeToAccount,
          totalAmount,
          lineItems: {
            create: lineItems.map((item: any, idx: number) => ({
              itemId: item.itemId || null,
              description: item.description,
              unit: item.unit,
              quantity: Number(item.quantity),
              unitCost: Number(item.unitCost),
              totalCost: Number(item.quantity) * Number(item.unitCost),
              sortOrder: idx,
            })),
          },
        },
        include: { lineItems: true },
      });
    });

    return NextResponse.json(updatedPR);
  } catch (error) {
    console.error("PR Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    if (pr.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft PRs can be deleted" }, { status: 400 });
    }

    await prisma.purchaseRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
