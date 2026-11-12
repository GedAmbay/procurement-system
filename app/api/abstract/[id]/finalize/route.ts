import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";
import { checkFinalizeEligibility, evaluateAbstractBids } from "@/lib/money";
import { syncAwardedSupplierToPO } from "@/lib/po-award-sync";
import { syncRfqStatus } from "@/lib/rfq-status";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER", "ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const abstract = await (prisma as any).abstractOfCanvass.findUnique({
      where: { id },
      include: {
        rfq: {
          include: {
            lineItems: { orderBy: { sortOrder: "asc" } },
            quotations: {
              include: {
                supplier: true,
                lineItems: true,
              },
            },
          },
        },
      },
    });

    if (!abstract || !abstract.rfq) {
      return NextResponse.json({ error: "Abstract of Canvass not found" }, { status: 404 });
    }

    const rfqLineItems = abstract.rfq.lineItems || [];
    const quotations = abstract.rfq.quotations || [];

    // Server-side strict re-validation
    const eligibility = checkFinalizeEligibility(quotations, rfqLineItems);
    if (!eligibility.canFinalize) {
      return NextResponse.json(
        {
          error: eligibility.disabledReason || "Finalize eligibility conditions are not satisfied.",
          checklist: eligibility.checklist,
          pendingSuppliers: eligibility.pendingSuppliers,
          missingDateSuppliers: eligibility.missingDateSuppliers,
        },
        { status: 400 }
      );
    }

    const evaluation = evaluateAbstractBids(quotations, rfqLineItems);
    if (!evaluation.lowestBidder) {
      return NextResponse.json({ error: "No valid winning bidder found." }, { status: 400 });
    }

    // Single atomic write that sets status to ISSUED (Finalized in workflow) and locks bids
    const updated = await prisma.$transaction(async (tx) => {
      const updatedAbstract = await tx.abstractOfCanvass.update({
        where: { id },
        data: {
          status: "ISSUED",
          totalAmount: evaluation.lowestBidder!.totalBid,
        },
      });

      // Update RFQ status to COMPLETED
      await tx.rfq.update({
        where: { id: abstract.rfqId },
        data: { status: "COMPLETED" },
      });

      // Automatically sync winning supplier to Purchase Order
      try {
        await syncAwardedSupplierToPO(id, tx);
      } catch (poErr) {
        console.warn("syncAwardedSupplierToPO non-fatal error:", poErr);
      }

      return updatedAbstract;
    });

    return NextResponse.json({
      success: true,
      abstract: updated,
      winner: evaluation.lowestBidder,
    });
  } catch (error: any) {
    console.error("Finalize Abstract Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during finalization." },
      { status: 500 }
    );
  }
}

