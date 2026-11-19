import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const data = await req.json();
    const { signatoryId, startDate, endDate, leaveType, reason, approvedBy } = data;

    const updateData: any = {};
    if (signatoryId) updateData.signatoryId = signatoryId;
    if (startDate) updateData.startDate = new Date(`${startDate}T00:00:00Z`);
    if (endDate) updateData.endDate = new Date(`${endDate}T23:59:59Z`);
    if (leaveType !== undefined) updateData.leaveType = leaveType;
    if (reason !== undefined) updateData.reason = reason;
    if (approvedBy !== undefined) updateData.approvedBy = approvedBy;

    const updated = await prisma.bacLeaveRecord.update({
      where: { id },
      data: updateData,
      include: {
        signatory: {
          select: { id: true, name: true, position: true, role: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("BAC Leave PATCH error:", error);
    return NextResponse.json({ error: "Failed to update leave record" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await prisma.bacLeaveRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("BAC Leave DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete leave record" }, { status: 500 });
  }
}
