import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth-utils";
import { validatePasswordStrength } from "@/lib/password";

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
      username: true,
      email: true,
      role: true,
      officeId: true,
      isActive: true,
      mustChangePassword: true,
      lockedUntil: true,
      lastLoginAt: true,
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

  const currentUserId = roleCheck.user.id;
  const { id } = await params;
  const body = await req.json();

  if (body.isActive === false && currentUserId === id) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, isActive: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.username !== undefined) {
    const cleanUsername = String(body.username).trim();
    if (!/^[A-Za-z0-9._-]{3,40}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: "Employee ID / Username must be 3-40 characters (letters, numbers, ., _, -)." },
        { status: 400 }
      );
    }
    data.username = cleanUsername;
  }
  if (body.email !== undefined) {
    const cleanEmail = body.email ? String(body.email).trim() : "";
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "Invalid notification email" }, { status: 400 });
    }
    data.email = cleanEmail || null;
  }
  if (body.role !== undefined) data.role = body.role;
  if (body.officeId !== undefined) data.officeId = body.officeId || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  let passwordReset = false;
  if (body.password && String(body.password).trim().length > 0) {
    const newPass = String(body.password).trim();
    const strength = validatePasswordStrength(newPass);
    if (!strength.valid) {
      return NextResponse.json({ error: strength.error }, { status: 400 });
    }
    data.password = await bcrypt.hash(newPass, 12);
    data.mustChangePassword = true;
    data.passwordChangedAt = new Date();
    data.failedLoginAttempts = 0;
    data.lockedUntil = null;
    passwordReset = true;
  }

  if (body.unlockAccount === true) {
    data.failedLoginAttempts = 0;
    data.lockedUntil = null;
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        officeId: true,
        isActive: true,
        mustChangePassword: true,
        lockedUntil: true,
        lastLoginAt: true,
        createdAt: true,
        office: { select: { id: true, name: true } },
      },
    });

    if (passwordReset) {
      await prisma.documentAuditLog.create({
        data: {
          documentType: "AUTH",
          documentId: updated.id,
          action: "PASSWORD_RESET",
          userId: currentUserId,
          notes: `Admin reset password for ${updated.username} (temporary password issued).`,
        },
      });
    }

    if (body.unlockAccount === true) {
      await prisma.documentAuditLog.create({
        data: {
          documentType: "AUTH",
          documentId: updated.id,
          action: "ACCOUNT_UNLOCKED",
          userId: currentUserId,
          notes: `Admin unlocked account ${updated.username}.`,
        },
      });
    }

    if (body.isActive !== undefined && Boolean(body.isActive) !== existing.isActive) {
      await prisma.documentAuditLog.create({
        data: {
          documentType: "USER",
          documentId: updated.id,
          action: updated.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
          userId: currentUserId,
          notes: `Admin ${updated.isActive ? "activated" : "deactivated"} account ${updated.username}.`,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : String(e.meta?.target || "");
      const msg = target.includes("username")
        ? "Employee ID / Username already exists"
        : "Notification email is already used by another account";
      return NextResponse.json({ error: msg }, { status: 409 });
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

  const currentUserId = roleCheck.user.id;
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
