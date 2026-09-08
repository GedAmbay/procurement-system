import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const sig = await prisma.signatory.update({
    where: { id },
    data: {
      name: body.name,
      position: body.position,
      role: body.role,
      officeId: body.officeId || null,
      isActive: body.isActive,
    },
    include: { office: true },
  });

  return NextResponse.json(sig);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.signatory.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
