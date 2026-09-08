import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offices = await prisma.office.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(offices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  try {
    const office = await prisma.office.create({
      data: { name: body.name, code: body.code, head: body.head || null },
    });
    return NextResponse.json(office, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Office code already exists" }, { status: 409 });
    throw e;
  }
}
