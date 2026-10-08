import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "BAC_SECRETARIAT") {
    // Only BAC / Admin needs to see these reminders per requirements
    return NextResponse.json([]);
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextThreeDays = new Date(today);
    nextThreeDays.setDate(today.getDate() + 3);

    const upcomingEvents = await prisma.calendarEvent.findMany({
      where: {
        eventType: { in: ["Award Date", "Bid Opening"] },
        eventDate: {
          gte: today,
          lte: nextThreeDays
        }
      },
      orderBy: { eventDate: 'asc' }
    });

    // Format them as notifications
    const notifications = upcomingEvents.map(evt => {
      const daysAway = Math.floor((new Date(evt.eventDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let timeText = daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`;
      
      return {
        id: evt.id,
        title: `Upcoming ${evt.eventType}`,
        message: `${evt.title} is scheduled for ${timeText}.`,
        date: evt.eventDate,
        type: evt.eventType
      };
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Fetch Notifications Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
