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
  const upcoming = url.searchParams.get("upcoming");

  try {
    let whereClause: any = {};
    
    if (start && end) {
      whereClause.eventDate = {
        gte: new Date(start),
        lte: new Date(end)
      };
    } else if (upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      whereClause.eventDate = {
        gte: today,
        lte: thirtyDaysFromNow
      };
    }

    const events = await prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        pr: { select: { prNumber: true, purpose: true } }
      },
      orderBy: { eventDate: 'asc' }
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Fetch Events Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session || !session.user || !session.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await req.json();
    
    const event = await prisma.calendarEvent.create({
      data: {
        title: data.title,
        eventType: data.eventType,
        eventDate: new Date(data.eventDate),
        eventTime: data.eventTime || null,
        notes: data.notes || null,
        prId: data.prId || null,
        createdByUserId: session.user.id
      }
    });

    // Create Audit Trail
    await prisma.calendarEventHistory.create({
      data: {
        eventId: event.id,
        userId: session.user.id,
        action: "CREATED",
        changes: JSON.stringify(data)
      }
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Create Event Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
