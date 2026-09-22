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
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        lineItems: { orderBy: { sortOrder: "asc" } },
        aoq: {
          include: {
            rfq: {
              include: {
                pr: {
                  include: { office: true }
                }
              }
            }
          }
        }
      },
    });

    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    return NextResponse.json(po);
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

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: body.status !== undefined ? body.status : po.status,
        supplierId: body.supplierId !== undefined ? body.supplierId : po.supplierId,
        placeOfDelivery: body.placeOfDelivery !== undefined ? body.placeOfDelivery : po.placeOfDelivery,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : po.deliveryDate,
        deliveryTerms: body.deliveryTerms !== undefined ? body.deliveryTerms : po.deliveryTerms,
        paymentTerms: body.paymentTerms !== undefined ? body.paymentTerms : po.paymentTerms,
      },
    });

    return NextResponse.json(updatedPO);
  } catch (error) {
    console.error("PO Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
