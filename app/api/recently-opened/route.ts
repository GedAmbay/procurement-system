import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ items: [] });
    }

    // Try finding in DocumentAuditLog
    const logs = await prisma.documentAuditLog.findMany({
      where: {
        userId,
        action: "OPENED",
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    if (logs.length > 0) {
      const items = logs.map((log) => {
        let metadata: any = {};
        try {
          if (log.metadata) metadata = JSON.parse(log.metadata);
        } catch {
          // fallback
        }

        return {
          id: log.id,
          documentId: log.documentId,
          documentType: log.documentType,
          title: metadata.title || `${log.documentType} Document`,
          officeName: metadata.officeName || "Procurement Office",
          openedAt: log.createdAt.toISOString(),
          url: metadata.url || `/${log.documentType.toLowerCase()}s/${log.documentId}`,
        };
      });

      return NextResponse.json({ items });
    }

    // Fallback: fetch most recent PRs as starter documents
    const prs = await prisma.purchaseRequest.findMany({
      take: 4,
      orderBy: { updatedAt: "desc" },
      include: { office: true },
    });

    const fallbackItems = prs.map((pr) => ({
      id: pr.id,
      documentId: pr.id,
      documentType: "PR",
      title: pr.purpose || `PR #${pr.prNumber || "Draft"}`,
      officeName: pr.office?.name || "General Office",
      openedAt: pr.updatedAt.toISOString(),
      url: `/purchase-requests/${pr.id}`,
    }));

    return NextResponse.json({ items: fallbackItems });
  } catch (error) {
    console.error("Error fetching recently opened:", error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ success: true, message: "Guest/unauthenticated" });
    }

    const body = await req.json();
    const { documentId, documentType, title, officeName, url } = body;

    if (!documentId || !documentType) {
      return NextResponse.json({ error: "Missing documentId or documentType" }, { status: 400 });
    }

    await prisma.documentAuditLog.create({
      data: {
        userId,
        documentId,
        documentType,
        action: "OPENED",
        notes: `Opened ${documentType}`,
        metadata: JSON.stringify({ title, officeName, url }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging document open:", error);
    return NextResponse.json({ error: "Failed to log opened document" }, { status: 500 });
  }
}

