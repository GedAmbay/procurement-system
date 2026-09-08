import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.fundSource.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
