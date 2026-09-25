import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const acceptance = await prisma.acceptance.findUnique({
      where: { id },
      include: {
        po: {
          include: {
            supplier: true,
            aoq: {
              include: {
                rfq: {
                  include: {
                    pr: {
                      include: {
                        office: true,
                      }
                    }
                  }
                }
              }
            }
          }
        },
        lineItems: {
          include: {
            poLineItem: true,
          }
        }
      },
    });

    if (!acceptance) {
      return NextResponse.json({ error: "Acceptance not found" }, { status: 404 });
    }

    return NextResponse.json(acceptance);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      invoiceNumber,
      invoiceDate,
      dateReceived,
      dateInspected,
      status,
      lineItems
    } = body;

    // Start a transaction if line items are updated
    const updatePromises = [];
    
    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        updatePromises.push(
          prisma.acceptanceLineItem.update({
            where: { id: item.id },
            data: { quantityDelivered: Number(item.quantityDelivered) || 0 }
          })
        );
      }
    }

    // Update main acceptance record
    const updatedAcceptance = await prisma.acceptance.update({
      where: { id },
      data: {
        invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        dateReceived: dateReceived ? new Date(dateReceived) : null,
        dateInspected: dateInspected ? new Date(dateInspected) : null,
        status: status || undefined,
      },
      include: {
        lineItems: {
          include: {
            poLineItem: true
          }
        },
        po: {
          include: {
            lineItems: {
              include: {
                acceptanceItems: true
              }
            }
          }
        }
      }
    });

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    // Check if PO should be marked as completed
    if (status === "ISSUED" || status === "COMPLETED") {
      let isFullyDelivered = true;
      for (const poItem of updatedAcceptance.po.lineItems) {
        const totalDelivered = poItem.acceptanceItems.reduce((acc, curr) => acc + curr.quantityDelivered, 0);
        if (totalDelivered < poItem.quantity) {
          isFullyDelivered = false;
          break;
        }
      }

      await prisma.purchaseOrder.update({
        where: { id: updatedAcceptance.poId },
        data: {
          status: isFullyDelivered ? "COMPLETED" : "PARTIALLY_DELIVERED"
        }
      });
    }

    return NextResponse.json(updatedAcceptance);
  } catch (error: any) {
    console.error("PUT Acceptance Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
