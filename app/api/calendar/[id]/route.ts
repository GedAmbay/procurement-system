import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session || !session.user || !session.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const data = await req.json();
    
    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: data.title,
        eventType: data.eventType,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        eventTime: data.eventTime,
        notes: data.notes,
        prId: data.prId
      }
    });

    await prisma.calendarEventHistory.create({
      data: {
        eventId: event.id,
        userId: session.user.id,
        action: "UPDATED",
        changes: JSON.stringify(data)
      }
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error("Update Event Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session || !session.user || !session.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    // Audit before delete
    await prisma.calendarEventHistory.create({
      data: {
        eventId: id,
        userId: session.user.id,
        action: "DELETED",
        changes: "{}"
      }
    });

    await prisma.calendarEvent.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Event Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
