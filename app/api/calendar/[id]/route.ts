import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  // Handle projected recurring birthday id like "cmuz8yxts0001-2026"
  const cleanId = id.includes("-20") ? id.split("-20")[0] : id;

  try {
    const data = await req.json();

    let notesPayload: string | null = undefined as any;
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
    } else if (data.notes !== undefined) {
      notesPayload = data.notes;
    }

    const event = await prisma.calendarEvent.update({
      where: { id: cleanId },
      data: {
        title: data.title,
        eventType: data.eventType,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        eventTime: data.eventTime,
        notes: notesPayload,
        prId: data.prId,
      },
      include: {
        pr: { select: { id: true, prNumber: true, purpose: true } },
      },
    });

    await prisma.calendarEventHistory.create({
      data: {
        eventId: event.id,
        userId: session.user.id,
        action: "UPDATED",
        changes: JSON.stringify(data),
      },
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
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const cleanId = id.includes("-20") ? id.split("-20")[0] : id;

  try {
    await prisma.calendarEventHistory.create({
      data: {
        eventId: cleanId,
        userId: session.user.id,
        action: "DELETED",
        changes: "{}",
      },
    });

    await prisma.calendarEvent.delete({
      where: { id: cleanId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Event Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
