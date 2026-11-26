import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

const PROCUREMENT_EVENT_KEYWORDS = ["award", "pre-bid", "pre bid", "bid opening", "bidding", "pre-proc", "pre proc"];

function isProcurementScheduleEvent(eventType: string, title?: string): boolean {
  const combined = `${eventType || ""} ${title || ""}`.toLowerCase();
  return PROCUREMENT_EVENT_KEYWORDS.some((kw) => combined.includes(kw));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month"); // YYYY-MM

  const now = new Date();
  let year = now.getFullYear();
  let monthIndex = now.getMonth();

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
      year = y;
      monthIndex = m - 1;
    }
  }

  const monthStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  const signatory = await prisma.signatory.findUnique({
    where: { id },
    include: {
      office: { select: { id: true, name: true, code: true } },
    },
  });

  if (!signatory) {
    return NextResponse.json({ error: "Signatory not found" }, { status: 404 });
  }

  const [attendances, monthLeaves, allLeaves, rawCalendarEvents] = await Promise.all([
    prisma.bacAttendance.findMany({
      where: {
        signatoryId: id,
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { date: "asc" },
    }),
    prisma.bacLeaveRecord.findMany({
      where: {
        signatoryId: id,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.bacLeaveRecord.findMany({
      where: { signatoryId: id },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
    prisma.calendarEvent.findMany({
      where: {
        eventDate: { gte: monthStart, lte: monthEnd },
      },
      include: {
        pr: { select: { id: true, prNumber: true, purpose: true } },
      },
      orderBy: { eventDate: "asc" },
    }),
  ]);

  const calendarEvents = rawCalendarEvents.filter((ev) =>
    isProcurementScheduleEvent(ev.eventType, ev.title)
  );

  return NextResponse.json({
    signatory,
    month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    attendances,
    monthLeaves,
    allLeaves,
    calendarEvents,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

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
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const [prCount, rfqCount] = await Promise.all([
      prisma.purchaseRequest.count({ where: { requestedBySignatoryId: id } }),
      prisma.rfq.count({ where: { signatoryId: id } }),
    ]);

    if (prCount > 0 || rfqCount > 0) {
      const reasons: string[] = [];
      if (prCount > 0) reasons.push(`${prCount} purchase request(s)`);
      if (rfqCount > 0) reasons.push(`${rfqCount} RFQ(s)`);

      return NextResponse.json(
        { error: `Cannot delete signatory: it is currently referenced by ${reasons.join(", ")}.` },
        { status: 400 }
      );
    }

    await prisma.signatory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to delete signatory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
