import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      officeId: true,
      isActive: true,
      createdAt: true,
      office: { select: { id: true, name: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  const currentUserId = (session?.user as any)?.id;
  const { id } = await params;
  const body = await req.json();

  if (body.isActive === false && currentUserId === id) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account" },
      { status: 400 }
    );
  }

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.email !== undefined) data.email = body.email;
  if (body.role !== undefined) data.role = body.role;
  if (body.officeId !== undefined) data.officeId = body.officeId || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.password && body.password.trim().length > 0) {
    data.password = await bcrypt.hash(body.password, 12);
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        officeId: true,
        isActive: true,
        createdAt: true,
        office: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  const currentUserId = (session?.user as any)?.id;
  const { id } = await params;

  if (currentUserId === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const permanent = url.searchParams.get("permanent") === "true";

  if (permanent) {
    try {
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ success: true, message: "User permanently deleted" });
    } catch {
      // If user has foreign key constraints, fallback to deactivate
      await prisma.user.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        success: true,
        message: "User was deactivated instead because related procurement records exist.",
      });
    }
  } else {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: "User account deactivated" });
  }
}
