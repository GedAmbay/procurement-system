import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const item = await prisma.item.update({
    where: { id },
    data: {
      code: body.code || null,
      description: body.description,
      unit: body.unit,
      standardCost: parseFloat(body.standardCost) || 0,
      category: body.category || null,
      isActive: body.isActive,
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const lineItemCount = await prisma.prLineItem.count({ where: { itemId: id } });

    if (lineItemCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete item: it is currently referenced by ${lineItemCount} purchase request item(s).` },
        { status: 400 }
      );
    }

    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to delete item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
