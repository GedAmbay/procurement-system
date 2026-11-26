import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { validatePasswordStrength } from "@/lib/password";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      nickname: true,
      username: true,
      email: true,
      role: true,
      office: { select: { name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    username: user.username,
    email: user.email,
    role: user.role,
    officeName: user.office?.name ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const rawNickname = typeof body.nickname === "string" ? body.nickname.trim() : undefined;

  if (rawNickname !== undefined && rawNickname.length > 50) {
    return NextResponse.json(
      { error: "Nickname must be 50 characters or fewer." },
      { status: 400 }
    );
  }

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const confirmPassword = String(body.confirmPassword || "");
  const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      isActive: true,
      username: true,
      nickname: true,
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Account is not active." }, { status: 403 });
  }

  const updateData: {
    nickname?: string | null;
    password?: string;
    mustChangePassword?: boolean;
    passwordChangedAt?: Date;
    failedLoginAttempts?: number;
    lockedUntil?: null;
  } = {};

  if (rawNickname !== undefined) {
    updateData.nickname = rawNickname.length > 0 ? rawNickname : null;
  }

  if (wantsPasswordChange) {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "All password fields are required to change your password." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json({ error: strength.error }, { status: 400 });
    }

    const matchesCurrent = await bcrypt.compare(currentPassword, user.password);
    if (!matchesCurrent) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 }
      );
    }

    updateData.password = await bcrypt.hash(newPassword, 12);
    updateData.mustChangePassword = false;
    updateData.passwordChangedAt = new Date();
    updateData.failedLoginAttempts = 0;
    updateData.lockedUntil = null;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: { nickname: true },
  });

  if (wantsPasswordChange) {
    await prisma.documentAuditLog.create({
      data: {
        documentType: "AUTH",
        documentId: user.id,
        action: "PASSWORD_CHANGED",
        userId: user.id,
        notes: `User ${user.username} changed their password.`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    nickname: updated.nickname,
    passwordChanged: wantsPasswordChange,
  });
}
