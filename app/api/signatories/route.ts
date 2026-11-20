import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") ?? "";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const signatories = await prisma.signatory.findMany({
    where: {
      ...(role ? { role } : {}),
      isActive: true,
    },
    include: {
      office: true,
    },
    orderBy: { name: "asc" },
  });

  // Safely query active leaves without breaking when the relation is not directly on Signatory model
  let activeLeaves: any[] = [];
  try {
    if (typeof (prisma as any).bacLeaveRecord?.findMany === "function") {
      activeLeaves = await (prisma as any).bacLeaveRecord.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
        },
      });
    }
  } catch (err) {
    console.error("BAC leaves query error in signatories route:", err);
  }

  const enrichedSignatories = signatories.map((sig) => ({
    ...sig,
    bacLeaves: activeLeaves.filter((l) => l.signatoryId === sig.id),
  }));

  return NextResponse.json(enrichedSignatories);
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

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
