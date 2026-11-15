import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLivePreviewUrl } from "@/lib/recently-opened";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ items: [] });
    }

    const itemsMap = new Map<string, any>();

    // 1. Fetch recent activity logs from DocumentAuditLog
    const logs = await prisma.documentAuditLog.findMany({
      where: {
        userId,
        action: { in: ["OPENED", "SAVE", "UPDATE", "CREATE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    for (const log of logs) {
      if (itemsMap.has(log.documentId)) continue;

      let metadata: any = {};
      try {
        if (log.metadata) metadata = JSON.parse(log.metadata);
      } catch {
        // fallback
      }

      const docType = log.documentType === "PURCHASE_REQUEST" ? "PR"
        : log.documentType === "PURCHASE_ORDER" ? "PO"
        : log.documentType;

      const liveUrl = getLivePreviewUrl(docType, log.documentId);

      itemsMap.set(log.documentId, {
        id: log.id,
        documentId: log.documentId,
        documentType: docType,
        title: metadata.title || `${docType} Document`,
        officeName: metadata.officeName || "Procurement Office",
        openedAt: log.createdAt.toISOString(),
        url: liveUrl,
      });

      if (itemsMap.size >= 20) break;
    }

    // 2. Supplement with recent database records if fewer than 20
    if (itemsMap.size < 20) {
      const remaining = 20 - itemsMap.size;

      const [prs, rfqs, abstracts, pos, acceptances] = await Promise.all([
        prisma.purchaseRequest.findMany({
          take: Math.min(10, remaining),
          orderBy: { updatedAt: "desc" },
          include: { office: true },
        }),
        prisma.rfq.findMany({
          take: 6,
          orderBy: { updatedAt: "desc" },
          include: { pr: { include: { office: true } } },
        }),
        prisma.abstractOfCanvass.findMany({
          take: 6,
          orderBy: { updatedAt: "desc" },
          include: { rfq: { include: { pr: { include: { office: true } } } } },
        }),
        prisma.purchaseOrder.findMany({
          take: 6,
          orderBy: { updatedAt: "desc" },
          include: { pr: { include: { office: true } } },
        }),
        prisma.acceptance.findMany({
          take: 6,
          orderBy: { updatedAt: "desc" },
          include: { po: { include: { pr: { include: { office: true } } } } },
        }),
      ]);

      const candidates: any[] = [];

      for (const pr of prs) {
        candidates.push({
          id: pr.id,
          documentId: pr.id,
          documentType: "PR",
          title: pr.purpose ? (pr.purpose.length > 50 ? `${pr.purpose.slice(0, 47)}...` : pr.purpose) : `PR #${pr.prNumber || "Draft"}`,
          officeName: pr.office?.name || "Procurement Office",
          openedAt: pr.updatedAt.toISOString(),
          url: getLivePreviewUrl("PR", pr.id),
        });
      }

      for (const rfq of rfqs) {
        candidates.push({
          id: rfq.id,
          documentId: rfq.id,
          documentType: "RFQ",
          title: rfq.rfqNumber ? `RFQ #${rfq.rfqNumber}` : `RFQ for PR #${rfq.pr?.prNumber || ""}`,
          officeName: rfq.pr?.office?.name || "BAC Office",
          openedAt: rfq.updatedAt.toISOString(),
          url: getLivePreviewUrl("RFQ", rfq.id),
        });
      }

      for (const abs of abstracts) {
        candidates.push({
          id: abs.id,
          documentId: abs.id,
          documentType: "Abstract",
          title: abs.abstractNumber ? `Abstract #${abs.abstractNumber}` : "Abstract of Canvass",
          officeName: abs.rfq?.pr?.office?.name || "BAC Office",
          openedAt: abs.updatedAt.toISOString(),
          url: getLivePreviewUrl("Abstract", abs.id),
        });
      }

      for (const po of pos) {
        candidates.push({
          id: po.id,
          documentId: po.id,
          documentType: "PO",
          title: po.poNumber ? `PO #${po.poNumber}` : "Purchase Order",
          officeName: po.pr?.office?.name || "General Services Office",
          openedAt: po.updatedAt.toISOString(),
          url: getLivePreviewUrl("PO", po.id),
        });
      }

      for (const acc of acceptances) {
        candidates.push({
          id: acc.id,
          documentId: acc.id,
          documentType: "Acceptance",
          title: acc.airNumber ? `AIR #${acc.airNumber}` : "Inspection & Acceptance",
          officeName: acc.po?.pr?.office?.name || "Inspection Office",
          openedAt: acc.updatedAt.toISOString(),
          url: getLivePreviewUrl("Acceptance", acc.id),
        });
      }

      candidates.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

      for (const c of candidates) {
        if (!itemsMap.has(c.documentId)) {
          itemsMap.set(c.documentId, c);
        }
        if (itemsMap.size >= 20) break;
      }
    }

    const items = Array.from(itemsMap.values()).slice(0, 20);

    return NextResponse.json({ items });
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

