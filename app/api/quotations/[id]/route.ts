import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { submittedAt, remarks, lineItems } = body;

    const totalAmount = lineItems?.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0) || 0;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update quotation headers
      const updatedQuotation = await tx.quotation.update({
        where: { id },
        data: {
          submittedAt: submittedAt ? new Date(submittedAt) : null,
          remarks,
          totalAmount,
        }
      });

      // 2. Update all quotation line items
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await tx.quotationLineItem.update({
            where: { id: item.id },
            data: {
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.totalPrice),
            }
          });
        }
      }

      return updatedQuotation;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Quotation Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
