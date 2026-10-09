import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { purchaseRequestSchema } from "@/lib/zod-schemas";
import { requireRole } from "@/lib/auth-utils";
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        office: true,
        requestedBy: { select: { id: true, name: true, role: true } },
        requestedBySignatory: true,
        fundSource: true,
        lineItems: { orderBy: { sortOrder: "asc" }, include: { item: true } },
        calendarEvents: { orderBy: { eventDate: "asc" } },
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
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    const body = await req.json();

    // Full update is allowed indefinitely (unlocked in UI)

    const parseResult = purchaseRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid data", details: parseResult.error.format() }, { status: 400 });
    }

    const { officeId, purpose, requestedBySignatoryId, fundSourceId, chargeToAccount, isDirectAcquisition, lineItems } = parseResult.data;
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
          requestedBySignatoryId: requestedBySignatoryId || null,
          fundSourceId: fundSourceId || null,
          chargeToAccount,
          isDirectAcquisition,
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
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    await prisma.purchaseRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
