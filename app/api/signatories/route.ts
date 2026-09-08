import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") ?? "";

  const signatories = await prisma.signatory.findMany({
    where: {
      ...(role ? { role } : {}),
    },
    include: { office: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(signatories);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sig = await prisma.signatory.create({
    data: {
      name: body.name,
      position: body.position,
      role: body.role,
      officeId: body.officeId || null,
    },
    include: { office: true },
  });

  return NextResponse.json(sig, { status: 201 });
}
