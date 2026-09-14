import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { purchaseRequestSchema, purchaseRequestStatusUpdateSchema } from "@/lib/zod-schemas";
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        office: true,
        requestedBy: { select: { id: true, name: true, role: true } },
        requestedBySignatory: true,
        fundSource: true,
        lineItems: { orderBy: { sortOrder: "asc" }, include: { item: true } },
      },
    });

    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    return NextResponse.json(pr);
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
  const user = session.user as any;

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    const body = await req.json();

    // Check if it's just a status update
    if (body.status && Object.keys(body).length === 1) {
      const parseResult = purchaseRequestStatusUpdateSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json({ error: "Invalid status data", details: parseResult.error.format() }, { status: 400 });
      }
      
      const updatedPR = await prisma.$transaction(async (tx) => {
        const prUpdate = await tx.purchaseRequest.update({
          where: { id },
          data: { status: body.status },
          include: { fundSource: true, lineItems: true }
        });
        
        // Automatic generation of RFQ, AOQ, PO when FOR_RFQ
        if (body.status === "FOR_RFQ") {
          const existingRfq = await tx.rfq.findFirst({ where: { prId: id } });
          
          if (!existingRfq) {
            let fundPrefix = "GF";
            if (prUpdate.fundSource && prUpdate.fundSource.code.toUpperCase().startsWith("TF")) {
              fundPrefix = "TF";
            }
            
            const yy = String(prUpdate.fiscalYear).slice(-2) || String(new Date().getFullYear()).slice(-2);
            const prParts = prUpdate.prNumber.split("-");
            const xxxx = prParts[prParts.length - 1]; 
            const rfqNumber = `${fundPrefix}-${yy}-${xxxx}`;
            
            const rfq = await tx.rfq.create({
              data: {
                rfqNumber,
                prId: id,
                fiscalYear: prUpdate.fiscalYear,
                status: "DRAFT",
                lineItems: {
                  create: prUpdate.lineItems.map(li => ({
                    description: li.description,
                    unit: li.unit,
                    quantity: li.quantity,
                    unitCost: li.unitCost,
                    totalCost: li.totalCost,
                    sortOrder: li.sortOrder
                  }))
                }
              }
            });
            
            const aoqNumber = `${rfqNumber}-AOQ`;
            
            const aoq = await tx.abstractOfQuotation.create({
              data: {
                aoqNumber,
                rfqId: rfq.id,
                fiscalYear: prUpdate.fiscalYear,
                totalAmount: prUpdate.totalAmount, 
                status: "DRAFT",
                lineItems: {
                  create: prUpdate.lineItems.map(li => ({
                    description: li.description,
                    unit: li.unit,
                    quantity: li.quantity,
                    lowestUnitPrice: 0,
                    totalPrice: 0,
                    sortOrder: li.sortOrder
                  }))
                }
              }
            });
            
            const poNumber = `${rfqNumber}-PO`;
            
            await tx.purchaseOrder.create({
              data: {
                poNumber,
                aoqId: aoq.id,
                fiscalYear: prUpdate.fiscalYear,
                totalAmount: prUpdate.totalAmount,
                status: "DRAFT",
                lineItems: {
                  create: prUpdate.lineItems.map(li => ({
                    description: li.description,
                    unit: li.unit,
                    quantity: li.quantity,
                    unitPrice: li.unitCost,
                    totalPrice: li.totalCost,
                    sortOrder: li.sortOrder
                  }))
                }
              }
            });
          }
        }
        
        return prUpdate;
      });

      return NextResponse.json(updatedPR);
    }

    // Otherwise, full update (only allowed if DRAFT, SUBMITTED or REJECTED)
    if (pr.status !== "DRAFT" && pr.status !== "REJECTED" && pr.status !== "SUBMITTED") {
      return NextResponse.json({ error: "Cannot edit approved or processed PR" }, { status: 400 });
    }

    const parseResult = purchaseRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid data", details: parseResult.error.format() }, { status: 400 });
    }

    const { officeId, purpose, requestedBySignatoryId, fundSourceId, chargeToAccount, lineItems } = parseResult.data;
    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0);

    const updatedPR = await prisma.$transaction(async (tx) => {
      // 1. Delete old line items
      await tx.prLineItem.deleteMany({ where: { prId: id } });

      // 2. Update PR and create new line items
      return await tx.purchaseRequest.update({
        where: { id },
        data: {
          officeId,
          purpose,
          requestedBySignatoryId: requestedBySignatoryId || null,
          fundSourceId: fundSourceId || null,
          chargeToAccount,
          totalAmount,
          lineItems: {
            create: lineItems.map((item: any, idx: number) => ({
              itemId: item.itemId || null,
              description: item.description,
              unit: item.unit,
              quantity: Number(item.quantity),
              unitCost: Number(item.unitCost),
              totalCost: Number(item.quantity) * Number(item.unitCost),
              sortOrder: idx,
            })),
          },
        },
        include: { lineItems: true },
      });
    });

    return NextResponse.json(updatedPR);
  } catch (error) {
    console.error("PR Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    if (pr.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft PRs can be deleted" }, { status: 400 });
    }

    await prisma.purchaseRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
