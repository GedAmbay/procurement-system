import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

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
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        createdBy: true,
        supplier: true,
        lineItems: { orderBy: { sortOrder: "asc" } },
        pr: {
          include: { office: true }
        },
        abstract: {
          include: {
            rfq: {
              include: {
                pr: {
                  include: { office: true }
                }
              }
            }
          }
        },
        acceptances: {
          include: {
            lineItems: true
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
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const body = await req.json();

    const po: any = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { abstract: { include: { rfq: true } } }
    });
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const orderType = body.orderType !== undefined ? body.orderType : po.orderType;

    let poNumberToSave: string | null | undefined = undefined;
    if (body.poNumber !== undefined) {
      poNumberToSave = body.poNumber && typeof body.poNumber === "string" && body.poNumber.trim() ? body.poNumber.trim() : null;
      if (poNumberToSave) {
        const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber: poNumberToSave } });
        if (existing && existing.id !== id) {
          return NextResponse.json({ error: "PO Number already in use by another Purchase Order" }, { status: 409 });
        }
      }
    }

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(poNumberToSave !== undefined ? { poNumber: poNumberToSave } : {}),
        status: body.status !== undefined ? body.status : po.status,
        orderType,
        supplierId: body.supplierId !== undefined ? body.supplierId : po.supplierId,
        placeOfDelivery: body.placeOfDelivery !== undefined ? body.placeOfDelivery : po.placeOfDelivery,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : po.deliveryDate,
        deliveryTerms: body.deliveryTerms !== undefined ? body.deliveryTerms : po.deliveryTerms,
        paymentTerms: body.paymentTerms !== undefined ? body.paymentTerms : po.paymentTerms,
      } as any,
    });

    // Sync orderType change back to PR if updated
    if (body.orderType !== undefined) {
      const prIdToUpdate = po.prId || po.abstract?.rfq?.prId;
      if (prIdToUpdate) {
        await prisma.purchaseRequest.update({
          where: { id: prIdToUpdate },
          data: { requestType: orderType === "JOB" ? "JOB" : "PURCHASE" } as any
        });
      }
    }

    return NextResponse.json(updatedPO);
  } catch (error) {
    console.error("PO Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
