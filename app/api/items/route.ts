import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";

  const items = await prisma.item.findMany({
    where: {
      ...(search ? {
        OR: [
          { description: { contains: search } },
          { code: { contains: search } },
          { unit: { contains: search } },
        ],
      } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: "asc" }, { description: "asc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const item = await prisma.item.create({
    data: {
      code: body.code || null,
      description: body.description,
      unit: body.unit,
      standardCost: parseFloat(body.standardCost) || 0,
      category: body.category || null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
