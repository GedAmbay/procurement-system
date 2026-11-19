import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";
import { syncAwardedSupplierToPO } from "@/lib/po-award-sync";
import { applyPoDescriptionEdits, parseDescriptionEdits } from "@/lib/line-item-descriptions";

// Reference text (RFQ rows, or PR rows for direct acquisition) used to show "Edited" markers / reset
const refLineItemsSelect = {
  lineItems: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, description: true, sortOrder: true },
  },
};

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
          include: { office: true, ...refLineItemsSelect }
        },
        abstract: {
          include: {
            rfq: {
              include: {
                ...refLineItemsSelect,
                pr: {
                  include: { office: true }
                },
                quotations: {
                  include: {
                    supplier: true,
                    lineItems: true,
                  }
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

    let refreshedPo = null;
    // Auto-sync supplier if not assigned yet and abstract has quotations
    if (!po.supplierId && po.abstractId) {
      await syncAwardedSupplierToPO(po.abstractId);
      refreshedPo = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          createdBy: true,
          supplier: true,
          lineItems: { orderBy: { sortOrder: "asc" } },
          pr: {
            include: { office: true, ...refLineItemsSelect }
          },
          abstract: {
            include: {
              rfq: {
                include: {
                  ...refLineItemsSelect,
                  pr: {
                    include: { office: true }
                  },
                  quotations: {
                    include: {
                      supplier: true,
                      lineItems: true,
                    }
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
    }

    const finalPo = refreshedPo || po;
    const lastLog = await prisma.documentAuditLog.findFirst({
      where: {
        documentId: id,
        action: { in: ["SAVE", "UPDATE", "CREATE"] },
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });
    const lastSavedBy = lastLog?.user?.name || finalPo?.createdBy?.name || null;

    return NextResponse.json({ ...finalPo, lastSavedBy });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER"]);
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

    const descriptionEdits = parseDescriptionEdits(body.lineItemDescriptions) || [];
    if (descriptionEdits.length > 0) {
      await prisma.$transaction(
        (tx) => applyPoDescriptionEdits(id, descriptionEdits, tx),
        { timeout: 20000 }
      );
    }

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      data: {
        ...(poNumberToSave !== undefined ? { poNumber: poNumberToSave } : {}),
        status: body.status !== undefined ? body.status : po.status,
        orderType,
        supplierId: body.supplierId !== undefined ? body.supplierId : po.supplierId,
        placeOfDelivery: body.placeOfDelivery !== undefined ? body.placeOfDelivery : po.placeOfDelivery,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : po.deliveryDate,
        deliveryTerms: body.deliveryTerms !== undefined ? body.deliveryTerms : po.deliveryTerms,
        paymentTerms: body.paymentTerms !== undefined ? body.paymentTerms : po.paymentTerms,
        remarks: body.requestingOffice !== undefined ? body.requestingOffice : (body.remarks !== undefined ? body.remarks : po.remarks),
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

    const user = session.user as any;
    if (user?.id) {
      await prisma.documentAuditLog.create({
        data: {
          documentType: "PURCHASE_ORDER",
          documentId: id,
          action: "SAVE",
          userId: user.id,
          metadata: JSON.stringify({ savedBy: user.name }),
        },
      });
    }

    return NextResponse.json({ ...updatedPO, lastSavedBy: user?.name || null });
  } catch (error) {
    console.error("PO Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
