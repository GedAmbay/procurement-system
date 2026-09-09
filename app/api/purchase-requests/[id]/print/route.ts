import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    const updatedPR = await prisma.$transaction(async (tx) => {
      // 1. Log the print action
      await tx.documentAuditLog.create({
        data: {
          documentType: "PR",
          documentId: id,
          action: pr.printCount === 0 ? "PRINTED" : "REPRINTED",
          userId: user.id,
        },
      });

      // 2. Increment print count
      return await tx.purchaseRequest.update({
        where: { id },
        data: {
          printCount: { increment: 1 },
          lastPrintedAt: new Date(),
          lastPrintedBy: user.name,
        },
      });
    });

    return NextResponse.json(updatedPR);
  } catch (error) {
    console.error("PR Print Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
