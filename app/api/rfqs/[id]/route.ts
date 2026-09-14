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
    const rfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        pr: {
          include: {
            office: true,
          }
        },
        lineItems: { orderBy: { sortOrder: "asc" } },
        quotations: {
          include: {
            supplier: true,
            lineItems: true,
          }
        },
      },
    });

    if (!rfq) return NextResponse.json({ error: "RFQ not found" }, { status: 404 });

    return NextResponse.json(rfq);
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

    // Handle Status Update
    if (body.status && Object.keys(body).length === 1) {
      const updatedRfq = await prisma.rfq.update({
        where: { id },
        data: { status: body.status },
      });
      return NextResponse.json(updatedRfq);
    }
    
    // Handle attaching a new supplier (creating a quotation)
    if (body.supplierId) {
      // Check if quotation already exists
      const existing = await prisma.quotation.findFirst({
        where: { rfqId: id, supplierId: body.supplierId }
      });
      
      if (existing) {
        return NextResponse.json({ error: "Supplier already added to this RFQ" }, { status: 400 });
      }

      // We need the RFQ line items to create the quotation line items
      const rfq = await prisma.rfq.findUnique({
        where: { id },
        include: { lineItems: true }
      });

      if (!rfq) return NextResponse.json({ error: "RFQ not found" }, { status: 404 });

      const newQuotation = await prisma.quotation.create({
        data: {
          rfqId: id,
          supplierId: body.supplierId,
          lineItems: {
            create: rfq.lineItems.map(li => ({
              rfqLineItemId: li.id,
              unitPrice: 0,
              totalPrice: 0,
            }))
          }
        },
        include: { supplier: true }
      });

      return NextResponse.json(newQuotation);
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    console.error("RFQ Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
