import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { auth } from "@/auth";

export async function GET() {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;
  try {
    const acceptances = await prisma.acceptance.findMany({
      include: {
        po: {
          include: {
            supplier: true,
            abstract: {
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
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();

  try {
    const body = await req.json();
    const { poId, fiscalYear, airNumber: inputAirNumber } = body;

    if (!poId) {
      return NextResponse.json({ error: "PO ID is required" }, { status: 400 });
    }

    const airNumber = inputAirNumber && typeof inputAirNumber === "string" && inputAirNumber.trim() ? inputAirNumber.trim() : null;

    if (airNumber) {
      const existing = await prisma.acceptance.findUnique({
        where: { airNumber },
      });
      if (existing) {
        return NextResponse.json({ error: "AIR Number already exists" }, { status: 409 });
      }
    }

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
        airNumber,
        poId,
        fiscalYear: fiscalYear || new Date().getFullYear(),
        createdById: session?.user?.id,
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
