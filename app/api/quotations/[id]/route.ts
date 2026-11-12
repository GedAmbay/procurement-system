import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";
import { syncRfqStatus } from "@/lib/rfq-status";
import { syncAwardedSupplierByRfq } from "@/lib/po-award-sync";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        supplier: true,
        rfq: {
          include: {
            pr: true,
            lineItems: { orderBy: { sortOrder: "asc" } },
          }
        },
        lineItems: true, // We need to map these to the RFQ line items on the frontend
      }
    });

    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    return NextResponse.json(quotation);
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER", "ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { submittedAt, remarks, lineItems, status: rawStatus } = body;

    let parsedSubmittedAt: Date | null = null;
    if (submittedAt) {
      const d = new Date(submittedAt);
      if (!isNaN(d.getTime())) {
        parsedSubmittedAt = d;
      }
    }

    const isNoBid = rawStatus === "NO_BID";

    const sanitizedLineItems = Array.isArray(lineItems)
      ? lineItems.map((item: any) => {
        const unitPrice = isNoBid ? 0 : (isNaN(Number(item.unitPrice)) ? 0 : Number(item.unitPrice));
        const totalPrice = isNoBid ? 0 : (isNaN(Number(item.totalPrice))
          ? unitPrice * (Number(item.quantity) || 0)
          : Number(item.totalPrice));
        return {
          id: item.id || undefined,
          rfqLineItemId: item.rfqLineItemId || undefined,
          unitPrice,
          totalPrice,
        };
      })
      : [];

    const totalAmount = sanitizedLineItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);

    const determinedStatus = isNoBid
      ? "NO_BID"
      : rawStatus === "RETURNED" || (parsedSubmittedAt && totalAmount > 0)
      ? "RETURNED"
      : rawStatus || "PENDING";

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update quotation headers
      const updatedQuotation = await (tx.quotation as any).update({
        where: { id },
        data: {
          status: determinedStatus,
          submittedAt: parsedSubmittedAt,
          remarks: remarks || null,
          totalAmount,
        }
      });

      // 2. Fetch existing quotation line items to safely update or create
      const existingItems = await tx.quotationLineItem.findMany({
        where: { quotationId: id }
      });

      if (sanitizedLineItems.length > 0) {
        for (const item of sanitizedLineItems) {
          // Match by id or by rfqLineItemId
          const existing = item.id
            ? existingItems.find((e) => e.id === item.id)
            : (item.rfqLineItemId ? existingItems.find((e) => e.rfqLineItemId === item.rfqLineItemId) : null);

          if (existing) {
            await tx.quotationLineItem.update({
              where: { id: existing.id },
              data: {
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              }
            });
          } else if (item.rfqLineItemId) {
            await tx.quotationLineItem.create({
              data: {
                quotationId: id,
                rfqLineItemId: item.rfqLineItemId,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              }
            });
          }
        }
      }

      // 3. Automatically synchronize RFQ status based on supplier quotations completion
      try {
        await syncRfqStatus(updatedQuotation.rfqId, tx);
      } catch (e) {
        console.warn("syncRfqStatus warning in quotation update:", e);
      }

      // 4. Automatically synchronize awarded supplier and pricing to Purchase Order
      try {
        await syncAwardedSupplierByRfq(updatedQuotation.rfqId, tx);
      } catch (e) {
        console.warn("syncAwardedSupplierByRfq warning in quotation update:", e);
      }

      return updatedQuotation;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Quotation Update Error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
