import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fundSources = await prisma.fundSource.findMany({
    orderBy: [{ fiscalYear: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(fundSources);
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const fs = await prisma.fundSource.create({
    data: {
      name: body.name,
      code: body.code,
      description: body.description || null,
      fiscalYear: parseInt(body.fiscalYear),
      totalBudget: parseFloat(body.totalBudget) || 0,
    },
  });

  return NextResponse.json(fs, { status: 201 });
}
