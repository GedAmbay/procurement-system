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
    const aoq = await prisma.abstractOfQuotation.findUnique({
      where: { id },
      include: {
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

    if (!aoq) return NextResponse.json({ error: "AOQ not found" }, { status: 404 });

    return NextResponse.json(aoq);
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

    if (status === "APPROVED") {
      const aoqToApprove = await prisma.abstractOfQuotation.findUnique({
        where: { id },
        include: { rfq: { include: { quotations: true } } }
      });
      
      if (aoqToApprove && aoqToApprove.rfq.quotations.length > 0) {
        const validBids = aoqToApprove.rfq.quotations.filter((q: any) => q.totalAmount > 0);
        if (validBids.length > 0) {
          const lowestBid = validBids.reduce((prev: any, current: any) => (prev.totalAmount < current.totalAmount) ? prev : current);
          
          await prisma.purchaseOrder.updateMany({
            where: { aoqId: id },
            data: { supplierId: lowestBid.supplierId }
          });
        }
      }
    }

    const updatedAoq = await prisma.abstractOfQuotation.update({
      where: { id },
      data: dataToUpdate,
    });
    return NextResponse.json(updatedAoq);
  } catch (error) {
    console.error("AOQ Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
