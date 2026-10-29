import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";
import { syncRfqStatus } from "@/lib/rfq-status";

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
    // Synchronize RFQ status with supplier quotations progress
    await syncRfqStatus(id);

    const rfq = await prisma.rfq.findUnique({
      where: { id },
      include: {
        pr: {
          include: {
            office: true,
          }
        },
        createdBy: true,
        signatory: true,
        abstract: {
          select: { id: true, abstractNumber: true, status: true }
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
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const body = await req.json();

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

      // Synchronize RFQ status after attaching supplier
      await syncRfqStatus(id);

      return NextResponse.json(newQuotation);
    }

    // Handle updates to status, signatoryId, deadline, remarks
    const dataToUpdate: any = {};

    if (body.status !== undefined) {
      dataToUpdate.status = body.status;
    }
    if (body.signatoryId !== undefined) {
      dataToUpdate.signatoryId = body.signatoryId ? body.signatoryId : null;
    }
    if (body.deadline !== undefined) {
      dataToUpdate.deadline = body.deadline ? new Date(body.deadline) : null;
    }
    if (body.rfqNumber !== undefined) {
      dataToUpdate.rfqNumber = body.rfqNumber ? body.rfqNumber.trim() : null;
    }
    if (body.remarks !== undefined) {
      dataToUpdate.remarks = body.remarks ? body.remarks : null;
    }

    if (Object.keys(dataToUpdate).length > 0) {
      const updatedRfq = await prisma.rfq.update({
        where: { id },
        data: dataToUpdate,
        include: {
          pr: { include: { office: true } },
          createdBy: true,
          signatory: true,
          lineItems: { orderBy: { sortOrder: "asc" } },
          quotations: { include: { supplier: true, lineItems: true } },
        },
      });
      return NextResponse.json(updatedRfq);
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    console.error("RFQ Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
