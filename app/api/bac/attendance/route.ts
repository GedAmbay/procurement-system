import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    // Normalize date to local start/end of day
    const queryDate = new Date(`${dateStr}T12:00:00Z`);
    const dayStart = new Date(queryDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(queryDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // 1. Fetch active BAC signatories
    const signatories = await prisma.signatory.findMany({
      where: {
        role: { in: ["BAC_CHAIRMAN", "BAC_VICE_CHAIRMAN", "BAC_MEMBER"] },
        isActive: true,
      },
      orderBy: { role: "asc" },
      select: { id: true, name: true, position: true, role: true },
    });

    // 2. Fetch approved leaves that cover this date
    const leaves = await prisma.bacLeaveRecord.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
    });

    // 3. Fetch recorded attendance for this date
    const attendances = await prisma.bacAttendance.findMany({
      where: {
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    // 4. Merge results for each member
    const members = signatories.map((sig) => {
      // Check if on leave
      const activeLeave = leaves.find((l) => l.signatoryId === sig.id);
      if (activeLeave) {
        return {
          id: sig.id,
          name: sig.name,
          position: sig.position,
          role: sig.role,
          status: "ON_LEAVE" as const,
          leaveInfo: {
            id: activeLeave.id,
            leaveType: activeLeave.leaveType,
            reason: activeLeave.reason,
            startDate: activeLeave.startDate,
            endDate: activeLeave.endDate,
          },
          attendanceId: null,
          remarks: activeLeave.reason,
        };
      }

      // Check attendance record
      const att = attendances.find((a) => a.signatoryId === sig.id);
      return {
        id: sig.id,
        name: sig.name,
        position: sig.position,
        role: sig.role,
        status: (att ? att.status : "NOT_RECORDED") as
          | "PRESENT"
          | "ABSENT"
          | "EXCUSED"
          | "NOT_RECORDED",
        leaveInfo: null,
        attendanceId: att?.id || null,
        remarks: att?.remarks || null,
      };
    });

    return NextResponse.json({
      date: dateStr,
      members,
    });
  } catch (error) {
    console.error("BAC Attendance GET error:", error);
    return NextResponse.json({ error: "Failed to fetch BAC attendance" }, { status: 500 });
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
    const { signatoryId, date: dateStr, status, remarks, activityId } = data;

    if (!signatoryId || !dateStr || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Normalize date to noon UTC to avoid date shifting
    const targetDate = new Date(`${dateStr}T12:00:00Z`);
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    // Check if an existing record exists for this signatory and date
    const existing = await prisma.bacAttendance.findFirst({
      where: {
        signatoryId,
        date: {
          gte: dayStart,
          lte: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1),
        },
      },
    });

    let record;
    if (existing) {
      record = await prisma.bacAttendance.update({
        where: { id: existing.id },
        data: {
          status,
          remarks: remarks || null,
          activityId: activityId || null,
          recordedById: session.user.id,
        },
      });
    } else {
      record = await prisma.bacAttendance.create({
        data: {
          signatoryId,
          date: dayStart,
          status,
          remarks: remarks || null,
          activityId: activityId || null,
          recordedById: session.user.id,
        },
      });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("BAC Attendance POST error:", error);
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 });
  }
}
