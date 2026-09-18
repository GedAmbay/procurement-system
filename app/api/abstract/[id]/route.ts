import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    const body = await req.json();

    // Handle Status Update
    if (body.status && Object.keys(body).length === 1) {
      const updatedAoq = await prisma.abstractOfQuotation.update({
        where: { id },
        data: { status: body.status },
      });
      return NextResponse.json(updatedAoq);
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    console.error("AOQ Update Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
