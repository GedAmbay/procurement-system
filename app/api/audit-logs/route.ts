import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const search = searchParams.get("search")?.trim() || "";
    const documentType = searchParams.get("documentType")?.trim() || "";
    const action = searchParams.get("action")?.trim() || "";
    const userId = searchParams.get("userId")?.trim() || "";
    const startDate = searchParams.get("startDate")?.trim() || "";
    const endDate = searchParams.get("endDate")?.trim() || "";
    const isExport = searchParams.get("export") === "csv";

    // Build Prisma where filter
    const where: Prisma.DocumentAuditLogWhereInput = {};

    // Document Type filter (normalizing variants like PR/PURCHASE_REQUEST)
    if (documentType && documentType !== "ALL") {
      if (documentType === "PR") {
        where.documentType = { in: ["PR", "PURCHASE_REQUEST", "PURCHASE REQUEST"] };
      } else if (documentType === "PO") {
        where.documentType = { in: ["PO", "PURCHASE_ORDER", "PURCHASE ORDER"] };
      } else if (documentType === "RFQ") {
        where.documentType = { in: ["RFQ", "REQUEST_FOR_QUOTATION"] };
      } else if (documentType === "ABSTRACT") {
        where.documentType = { in: ["ABSTRACT", "ABSTRACT_OF_CANVASS"] };
      } else if (documentType === "ACCEPTANCE") {
        where.documentType = { in: ["ACCEPTANCE", "AIR", "INSPECTION"] };
      } else {
        where.documentType = documentType;
      }
    }

    // Action filter
    if (action && action !== "ALL") {
      if (action === "UPDATE") {
        where.action = { in: ["UPDATE", "SAVE"] };
      } else {
        where.action = action;
      }
    }

    // User filter
    if (userId && userId !== "ALL") {
      where.userId = userId;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Search filter across documentId, notes, metadata, or user
    if (search) {
      where.OR = [
        { documentId: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { metadata: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // If CSV export is requested:
    if (isExport) {
      const allMatching = await prisma.documentAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 2000,
        include: {
          user: {
            select: { name: true, email: true, role: true, office: { select: { name: true } } },
          },
        },
      });

      const csvRows = [
        ["Timestamp", "User", "Role", "Office", "Document Type", "Document ID", "Action", "Notes"].map(
          (h) => `"${h}"`
        ).join(","),
      ];

      for (const log of allMatching) {
        const role = log.user?.role === "END_USER" ? "Clerk" : log.user?.role || "";
        const row = [
          log.createdAt.toISOString(),
          log.user?.name || "System",
          role,
          log.user?.office?.name || "",
          log.documentType,
          log.documentId,
          log.action,
          (log.notes || "").replace(/"/g, '""'),
        ].map((val) => `"${val}"`);
        csvRows.push(row.join(","));
      }

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-trail-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // Standard paginated JSON response
    const [total, logs, usersList] = await Promise.all([
      prisma.documentAuditLog.count({ where }),
      prisma.documentAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              office: { select: { id: true, name: true } },
            },
          },
        },
      }),
      // Get all active users who have logs for the filter dropdown
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // High-level statistics
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCount, totalSystemLogs] = await Promise.all([
      prisma.documentAuditLog.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.documentAuditLog.count(),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        totalFiltered: total,
        totalSystemLogs,
        todayCount,
        usersCount: usersList.length,
      },
      users: usersList,
    });
  } catch (error: unknown) {
    console.error("Audit log API error:", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
