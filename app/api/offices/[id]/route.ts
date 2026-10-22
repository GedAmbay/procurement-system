import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const office = await prisma.office.findUnique({ where: { id } });
  if (!office) return NextResponse.json({ error: "Office not found" }, { status: 404 });

  return NextResponse.json(office);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  try {
    const office = await prisma.office.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code,
        head: body.head !== undefined ? (body.head || null) : undefined,
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });

    return NextResponse.json(office);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Office code or name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Failed to update office" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    // Check if there are associated records preventing deletion
    const [prCount, userCount, sigCount] = await Promise.all([
      prisma.purchaseRequest.count({ where: { officeId: id } }),
      prisma.user.count({ where: { officeId: id } }),
      prisma.signatory.count({ where: { officeId: id } }),
    ]);

    if (prCount > 0 || userCount > 0 || sigCount > 0) {
      const reasons: string[] = [];
      if (prCount > 0) reasons.push(`${prCount} purchase request(s)`);
      if (userCount > 0) reasons.push(`${userCount} user(s)`);
      if (sigCount > 0) reasons.push(`${sigCount} signatory(ies)`);

      return NextResponse.json(
        { error: `Cannot delete office: it is currently referenced by ${reasons.join(", ")}.` },
        { status: 400 }
      );
    }

    await prisma.office.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete office" }, { status: 500 });
  }
}
