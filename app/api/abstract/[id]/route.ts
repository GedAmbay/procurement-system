import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";
import { syncRfqStatus } from "@/lib/rfq-status";
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
    const abstract = await (prisma as any).abstractOfCanvass.findUnique({
      where: { id },
      include: {
        createdBy: true,
        rfq: {
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
          }
        },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!abstract) return NextResponse.json({ error: "abstract not found" }, { status: 404 });

    // Sync RFQ completion status
    if (abstract.rfqId) {
      const syncResult = await syncRfqStatus(abstract.rfqId);
      if (syncResult && abstract.rfq) {
        abstract.rfq.status = syncResult.status;
      }
    }

    return NextResponse.json(abstract);
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

    // Handle Metadata + Status Update
    const { status, docDate, bacResNo, dateReceived, dateAwarded, reqOfficerName, reqOfficerOffice, signatoriesData } = body;

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (docDate !== undefined) dataToUpdate.docDate = docDate ? new Date(docDate) : null;
    if (bacResNo !== undefined) dataToUpdate.bacResNo = bacResNo;
    if (dateReceived !== undefined) dataToUpdate.dateReceived = dateReceived ? new Date(dateReceived) : null;
    if (dateAwarded !== undefined) dataToUpdate.dateAwarded = dateAwarded ? new Date(dateAwarded) : null;
    if (reqOfficerName !== undefined) dataToUpdate.reqOfficerName = reqOfficerName;
    if (reqOfficerOffice !== undefined) dataToUpdate.reqOfficerOffice = reqOfficerOffice;
    if (signatoriesData !== undefined) dataToUpdate.signatoriesData = signatoriesData;

    const updatedabstract = await (prisma as any).abstractOfCanvass.update({
      where: { id },
      data: dataToUpdate,
    });

    // Automatically synchronize the awarded supplier and line items to the linked Purchase Order
    await syncAwardedSupplierToPO(id);

    if (updatedabstract.rfqId) {
      await syncRfqStatus(updatedabstract.rfqId);
    }

    return NextResponse.json(updatedabstract);
  } catch (error) {
    console.error("abstract Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
