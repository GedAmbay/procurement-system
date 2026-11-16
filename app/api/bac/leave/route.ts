import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const signatoryId = url.searchParams.get("signatoryId");

  try {
    let whereClause: any = {
      status: "APPROVED",
    };

    if (signatoryId) {
      whereClause.signatoryId = signatoryId;
    }

    if (start && end) {
      const qStart = new Date(start);
      qStart.setUTCHours(0, 0, 0, 0);
      const qEnd = new Date(end);
      qEnd.setUTCHours(23, 59, 59, 999);

      whereClause.startDate = { lte: qEnd };
      whereClause.endDate = { gte: qStart };
    }

    const leaves = await prisma.bacLeaveRecord.findMany({
      where: whereClause,
      include: {
        signatory: {
          select: { id: true, name: true, position: true, role: true },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(leaves);
  } catch (error) {
    console.error("BAC Leaves GET error:", error);
    return NextResponse.json({ error: "Failed to fetch BAC leaves" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const { signatoryId, startDate, endDate, leaveType, reason, approvedBy } = data;

    if (!signatoryId || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T23:59:59Z`);

    if (end < start) {
      return NextResponse.json({ error: "End date cannot be before start date" }, { status: 400 });
    }

    const leave = await prisma.bacLeaveRecord.create({
      data: {
        signatoryId,
        startDate: start,
        endDate: end,
        leaveType: leaveType || "VACATION",
        reason: reason || null,
        approvedBy: approvedBy || null,
        status: "APPROVED",
        createdById: session.user.id,
      },
      include: {
        signatory: {
          select: { id: true, name: true, position: true, role: true },
        },
      },
    });

    return NextResponse.json(leave, { status: 201 });
  } catch (error) {
    console.error("BAC Leave POST error:", error);
    return NextResponse.json({ error: "Failed to record leave" }, { status: 500 });
  }
}
