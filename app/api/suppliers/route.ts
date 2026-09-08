import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const active = searchParams.get("active");

  const suppliers = await prisma.supplier.findMany({
    where: {
      ...(active !== null ? { isActive: active === "true" } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { philgepsNo: { contains: search } },
          { tin: { contains: search } },
          { contactPerson: { contains: search } },
        ],
      } : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const supplier = await prisma.supplier.create({
    data: {
      name: body.name,
      philgepsNo: body.philgepsNo || null,
      tin: body.tin || null,
      address: body.address || null,
      contactPerson: body.contactPerson || null,
      contactNumber: body.contactNumber || null,
      email: body.email || null,
    },
  });

  return NextResponse.json(supplier, { status: 201 });
}
