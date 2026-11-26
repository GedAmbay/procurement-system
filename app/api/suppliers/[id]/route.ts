import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(supplier);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const supplier = await prisma.supplier.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(supplier);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const [poCount, quotationCount, rfqSupplierCount] = await Promise.all([
      prisma.purchaseOrder.count({ where: { supplierId: id } }),
      prisma.quotation.count({ where: { supplierId: id } }),
      prisma.rfqSupplier.count({ where: { supplierId: id } }),
    ]);

    if (poCount > 0 || quotationCount > 0 || rfqSupplierCount > 0) {
      const reasons: string[] = [];
      if (poCount > 0) reasons.push(`${poCount} purchase order(s)`);
      if (quotationCount > 0) reasons.push(`${quotationCount} quotation(s)`);
      if (rfqSupplierCount > 0) reasons.push(`${rfqSupplierCount} RFQ(s)`);

      return NextResponse.json(
        { error: `Cannot delete supplier: it is currently referenced by ${reasons.join(", ")}.` },
        { status: 400 }
      );
    }

    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to delete supplier";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
