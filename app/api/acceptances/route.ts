import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const acceptances = await prisma.acceptance.findMany({
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
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(acceptances);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { poId, fiscalYear } = body;

    if (!poId) {
      return NextResponse.json({ error: "PO ID is required" }, { status: 400 });
    }

    // Generate IAR Number (e.g. AIR-26-0001)
    const yearPrefix = (fiscalYear || new Date().getFullYear()).toString().slice(-2);
    const count = await prisma.acceptance.count({
      where: { iarNumber: { startsWith: `AIR-${yearPrefix}-` } },
    });
    const iarNumber = `AIR-${yearPrefix}-${(count + 1).toString().padStart(4, "0")}`;

    // Get PO line items and past deliveries
    const poLineItems = await prisma.poLineItem.findMany({
      where: { poId },
      include: {
        acceptanceItems: {
          include: {
            acceptance: true
          }
        }
      }
    });

    const acceptance = await prisma.acceptance.create({
      data: {
        iarNumber,
        poId,
        fiscalYear: fiscalYear || new Date().getFullYear(),
        lineItems: {
          create: poLineItems.map(item => {
            // Calculate previously delivered (only from non-DRAFT or all, let's say all for simplicity, or just ISSUED/COMPLETED)
            const delivered = item.acceptanceItems.reduce((acc, curr) => acc + curr.quantityDelivered, 0);
            const remaining = Math.max(0, item.quantity - delivered);
            
            return {
              poLineItemId: item.id,
              quantityDelivered: remaining, // default to remaining
            };
          })
        }
      },
      include: {
        lineItems: true,
      }
    });

    return NextResponse.json(acceptance);
  } catch (error: any) {
    console.error("POST Acceptance Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
