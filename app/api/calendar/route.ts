import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";
import { getPhilippineHolidaysForRange } from "@/lib/philippine-holidays";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const category = url.searchParams.get("category");
  const upcoming = url.searchParams.get("upcoming");

  try {
    let whereClause: any = {};

    if (category && category !== "ALL") {
      whereClause.eventType = category;
    }

    if (start && end) {
      whereClause.eventDate = {
        gte: new Date(start),
        lte: new Date(end),
      };
    } else if (upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      whereClause.eventDate = {
        gte: today,
        lte: thirtyDaysFromNow,
      };
    }

    const events = await prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        pr: { select: { id: true, prNumber: true, purpose: true } },
      },
      orderBy: { eventDate: "asc" },
    });

    // Handle annual recurring birthdays if start and end are provided
    if (start && end && (!category || category === "ALL" || category === "Birthday")) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const targetYear = startDate.getFullYear();

      // Query recurring birthdays
      const allBirthdays = await prisma.calendarEvent.findMany({
        where: {
          eventType: "Birthday",
        },
        include: {
          pr: { select: { id: true, prNumber: true, purpose: true } },
        },
      });

      for (const bday of allBirthdays) {
        let isRecurring = true;
        let bMonth = new Date(bday.eventDate).getMonth();
        let bDay = new Date(bday.eventDate).getDate();

        if (bday.notes) {
          try {
            const meta = JSON.parse(bday.notes);
            if (meta.isRecurring !== undefined) isRecurring = Boolean(meta.isRecurring);
            if (meta.birthMonth !== undefined && meta.birthMonth !== null) {
              bMonth = Number(meta.birthMonth) - 1;
            }
            if (meta.birthDay !== undefined && meta.birthDay !== null) {
              bDay = Number(meta.birthDay);
            }
          } catch {
            // Legacy plain string notes - default to annual recurrence for birthday
            isRecurring = true;
          }
        }

        if (isRecurring) {
          const projectedDate = new Date(targetYear, bMonth, bDay, 12, 0, 0);
          if (projectedDate >= startDate && projectedDate <= endDate) {
            const alreadyExists = events.some(
              (e) =>
                (e.id === bday.id || e.id.startsWith(`${bday.id}-`)) &&
                new Date(e.eventDate).toDateString() === projectedDate.toDateString()
            );
            if (!alreadyExists) {
              events.push({
                ...bday,
                id: `${bday.id}-${targetYear}`,
                eventDate: projectedDate,
              });
            }
          }
        }
      }
    }

    // Handle Philippine National Holidays
    const isHolidayCategory = !category || category === "ALL" || category === "Holiday" || category === "National Holiday";
    if (isHolidayCategory) {
      let holidayRangeStart: Date | null = null;
      let holidayRangeEnd: Date | null = null;

      if (start && end) {
        holidayRangeStart = new Date(start);
        holidayRangeEnd = new Date(end);
      } else if (upcoming) {
        holidayRangeStart = new Date();
        holidayRangeStart.setHours(0, 0, 0, 0);
        holidayRangeEnd = new Date(holidayRangeStart);
        holidayRangeEnd.setDate(holidayRangeStart.getDate() + 30);
      }

      if (holidayRangeStart && holidayRangeEnd) {
        const holidays = getPhilippineHolidaysForRange(holidayRangeStart, holidayRangeEnd);
        for (const holiday of holidays) {
          // Avoid duplicate if already declared in DB with similar name on the same date
          const alreadyExists = events.some(
            (e) =>
              new Date(e.eventDate).toDateString() === new Date(holiday.eventDate).toDateString() &&
              (e.title.toLowerCase().includes(holiday.title.toLowerCase()) ||
                holiday.title.toLowerCase().includes(e.title.toLowerCase()))
          );
          if (!alreadyExists) {
            events.push(holiday as any);
          }
        }
      }
    }

    // Sort all events chronologically
    events.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

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
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();

    // Package structured metadata into notes JSON payload
    let notesPayload: string | null = null;
    const hasStructuredMeta =
      data.venue !== undefined ||
      data.description !== undefined ||
      data.participants !== undefined ||
      data.recipient !== undefined ||
      data.isRecurring !== undefined ||
      data.birthMonth !== undefined ||
      data.birthDay !== undefined;

    if (hasStructuredMeta) {
      notesPayload = JSON.stringify({
        notes: data.notes || "",
        venue: data.venue || "",
        description: data.description || "",
        participants: data.participants || "",
        recipient: data.recipient || "",
        isRecurring: data.isRecurring !== undefined ? data.isRecurring : data.eventType === "Birthday",
        birthMonth: data.birthMonth || null,
        birthDay: data.birthDay || null,
      });
    } else {
      notesPayload = data.notes || null;
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title: data.title,
        eventType: data.eventType,
        eventDate: new Date(data.eventDate),
        eventTime: data.eventTime || null,
        notes: notesPayload,
        prId: data.prId || null,
        createdByUserId: session.user.id,
      },
      include: {
        pr: { select: { id: true, prNumber: true, purpose: true } },
      },
    });

    // Create Audit Trail
    await prisma.calendarEventHistory.create({
      data: {
        eventId: event.id,
        userId: session.user.id,
        action: "CREATED",
        changes: JSON.stringify(data),
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Create Event Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
