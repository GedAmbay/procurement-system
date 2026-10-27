import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { purchaseRequestSchema } from "@/lib/zod-schemas";
import { requireRole } from "@/lib/auth-utils";
import { normalizePrNumber, deriveRfqNumber, fiscalYearFromPrNumber } from "@/lib/utils";
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
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        office: true,
        requestedBy: { select: { id: true, name: true, role: true } },
        requestedBySignatory: true,
        fundSource: true,
        lineItems: { orderBy: { sortOrder: "asc" }, include: { item: true } },
        calendarEvents: { orderBy: { eventDate: "asc" } },
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
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    const body = await req.json();

    // Full update is allowed indefinitely (unlocked in UI)

    const parseResult = purchaseRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const fieldPath = firstIssue?.path.join(".") || "data";
      const errorMsg = firstIssue?.message || `Invalid data for ${fieldPath}`;
      console.warn("PR patch validation failed:", errorMsg, parseResult.error.format());
      return NextResponse.json({ error: errorMsg, details: parseResult.error.format() }, { status: 400 });
    }

    const { officeId, purpose, requestedBySignatoryId, fundSourceId, chargeToAccount, isDirectAcquisition, requestType, lineItems } = parseResult.data;
    const newPrNumber = parseResult.data.prNumber ? normalizePrNumber(parseResult.data.prNumber) : (parseResult.data.prNumber === null ? null : pr.prNumber);
    const newFiscalYear = parseResult.data.fiscalYear || (newPrNumber ? fiscalYearFromPrNumber(newPrNumber) : null) || pr.fiscalYear;

    if (newPrNumber && newPrNumber !== pr.prNumber) {
      const existing = await prisma.purchaseRequest.findUnique({ where: { prNumber: newPrNumber } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "PR Number already in use by another request" }, { status: 409 });
      }
    }

    const fundSource = fundSourceId ? await prisma.fundSource.findUnique({ where: { id: fundSourceId } }) : null;
    const newRfqNumber = newPrNumber ? deriveRfqNumber(newPrNumber, newFiscalYear, fundSource?.code) : null;

    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0);

    const updatedPR = await prisma.$transaction(async (tx) => {
      // 1. Delete old line items
      await tx.prLineItem.deleteMany({ where: { prId: id } });

      // 2. Automatically synchronize orderType on any linked PurchaseOrder records
      await tx.purchaseOrder.updateMany({
        where: {
          OR: [
            { prId: id },
            { abstract: { rfq: { prId: id } } }
          ]
        },
        data: {
          orderType: requestType === "JOB" ? "JOB" : "PURCHASE",
          fiscalYear: newFiscalYear
        } as any
      });

      // 3. Update linked RFQs and Abstract if PR number or fiscal year changed
      await tx.rfq.updateMany({
        where: { prId: id },
        data: {
          rfqNumber: newRfqNumber,
          fiscalYear: newFiscalYear
        }
      });

      await (tx as any).abstractOfCanvass.updateMany({
        where: { rfq: { prId: id } },
        data: {
          abstractNumber: newPrNumber,
          fiscalYear: newFiscalYear
        }
      });

      // 4. Audit log if PR number changed
      if (newPrNumber !== pr.prNumber) {
        await tx.documentAuditLog.create({
          data: {
            documentType: "PURCHASE_REQUEST",
            documentId: id,
            action: "UPDATE_PR_NUMBER",
            userId: user.id,
            notes: `PR Number changed from ${pr.prNumber} to ${newPrNumber}`,
          }
        });
      }

      // 5. Update PR and create new line items
      return await tx.purchaseRequest.update({
        where: { id },
        data: {
          prNumber: newPrNumber,
          fiscalYear: newFiscalYear,
          officeId,
          purpose,
          requestedBySignatoryId: requestedBySignatoryId || null,
          fundSourceId: fundSourceId || null,
          chargeToAccount,
          isDirectAcquisition,
          requestType: requestType || "PURCHASE",
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
        } as any,
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
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

    await prisma.purchaseRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
