import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { userCreateSchema } from "@/lib/zod-schemas";
import { requireRole } from "@/lib/auth-utils";

export async function GET() {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
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

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(["ADMIN"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const body = await req.json();

  const parseResult = userCreateSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message || "Invalid data";
    return NextResponse.json(
      { error: firstIssue, details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { name, username, email, password, role, officeId } = parseResult.data;
  const hashed = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email: email || null,
        password: hashed,
        role,
        officeId: officeId || null,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        officeId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    await prisma.documentAuditLog.create({
      data: {
        documentType: "USER",
        documentId: user.id,
        action: "CREATE",
        userId: roleCheck.user.id,
        notes: `Created user account ${user.username} (${user.name}) with role ${user.role}.`,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : String(e.meta?.target || "");
      const msg = target.includes("username")
        ? "Employee ID / Username already exists"
        : target.includes("email")
        ? "Notification email is already used by another account"
        : "User already exists";
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    throw e;
  }
}
