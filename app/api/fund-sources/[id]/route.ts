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

  const fs = await prisma.fundSource.update({
    where: { id },
    data: {
      name: body.name,
      code: body.code,
      description: body.description || null,
      fiscalYear: parseInt(body.fiscalYear),
      totalBudget: parseFloat(body.totalBudget) || 0,
      isActive: body.isActive,
    },
  });

  return NextResponse.json(fs);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const prCount = await prisma.purchaseRequest.count({ where: { fundSourceId: id } });

    if (prCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete fund source: it is currently referenced by ${prCount} purchase request(s).` },
        { status: 400 }
      );
    }

    await prisma.fundSource.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to delete fund source";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
