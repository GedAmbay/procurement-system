import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";
import { syncAwardedSupplierToPO } from "@/lib/po-award-sync";

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
          include: { office: true, lineItems: { orderBy: { sortOrder: "asc" } } }
        },
        abstract: {
          include: {
            rfq: {
              include: {
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
            include: { office: true, lineItems: { orderBy: { sortOrder: "asc" } } }
          },
          abstract: {
            include: {
              rfq: {
                include: {
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

    // Handle updates to lineItems (description, brand, quantity, unit, price edits, deletes, and adds)
    if (body.deletedLineItemIds && Array.isArray(body.deletedLineItemIds) && body.deletedLineItemIds.length > 0) {
      await prisma.poLineItem.deleteMany({
        where: { id: { in: body.deletedLineItemIds }, poId: id },
      });
    }

    if (body.lineItems && Array.isArray(body.lineItems)) {
      for (let i = 0; i < body.lineItems.length; i++) {
        const item = body.lineItems[i];
        const qty = item.quantity !== undefined && item.quantity !== "" ? parseFloat(item.quantity) : 0;
        const price = item.unitPrice !== undefined && item.unitPrice !== "" ? parseFloat(item.unitPrice) : 0;
        const totalPrice = !isNaN(qty) && !isNaN(price) ? qty * price : 0;
        if (item.id) {
          await prisma.poLineItem.update({
            where: { id: item.id },
            data: {
              ...(item.description !== undefined ? { description: item.description } : {}),
              quantity: isNaN(qty) ? 0 : qty,
              ...(item.unit !== undefined ? { unit: item.unit } : {}),
              unitPrice: isNaN(price) ? 0 : price,
              totalPrice,
              sortOrder: i,
              ...(item.descriptionEdited !== undefined ? { descriptionEdited: !!item.descriptionEdited } : {}),
            }
          });
        } else if (item.description?.trim() || qty > 0) {
          await prisma.poLineItem.create({
            data: {
              poId: id,
              description: item.description || "",
              unit: item.unit || "Unit",
              quantity: isNaN(qty) ? 0 : qty,
              unitPrice: isNaN(price) ? 0 : price,
              totalPrice,
              sortOrder: i,
              descriptionEdited: !!item.descriptionEdited,
            }
          });
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
        remarks: body.requestingOffice !== undefined ? body.requestingOffice : (body.remarks !== undefined ? body.remarks : po.remarks),
      } as any,
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        supplier: true,
        pr: { include: { office: true, lineItems: { orderBy: { sortOrder: "asc" } } } },
        abstract: true,
        createdBy: true,
      }
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
