import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { purchaseRequestSchema } from "@/lib/zod-schemas";
import { requireRole } from "@/lib/auth-utils";
import { normalizePrNumber, deriveRfqNumber, fiscalYearFromPrNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const roleCheck = await requireRole(["ANY"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const officeId = url.searchParams.get("officeId") || "";
  const fiscalYear = url.searchParams.get("fiscalYear") || "";

  const user = session.user as any;
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { prNumber: { contains: search } },
      { purpose: { contains: search } },
      { office: { name: { contains: search } } },
      { office: { code: { contains: search } } },
    ];

    const parsedAmount = parseFloat(search.replace(/,/g, ''));
    if (!isNaN(parsedAmount)) {
      whereClause.OR.push({ totalAmount: { equals: parsedAmount } });
    }
  }
  if (status) {
    whereClause.status = status;
  }
  if (officeId) {
    whereClause.officeId = officeId;
  }
  if (fiscalYear && fiscalYear !== "null") {
    const parsedYear = parseInt(fiscalYear, 10);
    if (!isNaN(parsedYear)) {
      whereClause.fiscalYear = parsedYear;
    }
  }

  const prs = await prisma.purchaseRequest.findMany({
    where: whereClause,
    include: {
      office: { select: { name: true, code: true } },
      requestedBy: { select: { name: true } },
      fundSource: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(prs);
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(["ADMIN", "BAC_SECRETARIAT", "END_USER"]);
  if (!roleCheck.authorized) return roleCheck.response;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  try {
    const body = await req.json();
    const parseResult = purchaseRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const fieldPath = firstIssue?.path.join(".") || "data";
      const errorMsg = firstIssue?.message || `Invalid data for ${fieldPath}`;
      console.warn("PR validation failed:", errorMsg, parseResult.error.format());
      return NextResponse.json({ error: errorMsg, details: parseResult.error.format() }, { status: 400 });
    }

    const { officeId, purpose, requestedBySignatoryId, fundSourceId, chargeToAccount, isDirectAcquisition, requestType, lineItems } = parseResult.data;

    const prNumber = parseResult.data.prNumber ? normalizePrNumber(parseResult.data.prNumber) : null;
    const fiscalYear = parseResult.data.fiscalYear || (prNumber ? fiscalYearFromPrNumber(prNumber) : null) || new Date().getFullYear();

    // Check PR number uniqueness if provided
    if (prNumber) {
      const existingPr = await prisma.purchaseRequest.findUnique({
        where: { prNumber },
      });
      if (existingPr) {
        return NextResponse.json({ error: "PR Number already exists" }, { status: 409 });
      }
    }

    // Lookup fund source for RFQ prefix if needed
    const fundSource = fundSourceId
      ? await prisma.fundSource.findUnique({ where: { id: fundSourceId } })
      : null;
    const rfqNumber = prNumber ? deriveRfqNumber(prNumber, fiscalYear, fundSource?.code) : null;

    if (!isDirectAcquisition && rfqNumber) {
      const existingRfq = await prisma.rfq.findUnique({
        where: { rfqNumber },
      });
      if (existingRfq) {
        return NextResponse.json(
          { error: `Derived RFQ Number (${rfqNumber}) already exists. Please verify the PR Number.` },
          { status: 409 }
        );
      }
    }

    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitCost), 0);

    const pr = await prisma.$transaction(async (tx) => {
      const createdPr: any = await tx.purchaseRequest.create({
        data: {
          prNumber,
          officeId,
          requestedById: user.id,
          requestedBySignatoryId: requestedBySignatoryId || null,
          purpose,
          fundSourceId: fundSourceId || null,
          chargeToAccount,
          totalAmount,
          fiscalYear,
          isDirectAcquisition,
          requestType: requestType || "PURCHASE",
          lineItems: {
            create: lineItems.map((item: any, idx: number) => ({
              itemId: item.itemId || null,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              unitCost: item.unitCost,
              totalCost: item.quantity * item.unitCost,
              sortOrder: idx,
            })),
          },
        } as any,
        include: { lineItems: true, fundSource: true },
      });

      if (!isDirectAcquisition) {
        const rfq = await tx.rfq.create({
          data: {
            rfqNumber,
            prId: createdPr.id,
            fiscalYear: createdPr.fiscalYear,
            status: "DRAFT",
            createdById: user.id,
            lineItems: {
              create: createdPr.lineItems.map((li: any) => ({
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

        // Abstract references PR Number
        const abstract = await (tx as any).abstractOfCanvass.create({
          data: {
            abstractNumber: createdPr.prNumber,
            rfqId: rfq.id,
            fiscalYear: createdPr.fiscalYear,
            totalAmount: createdPr.totalAmount,
            status: "DRAFT",
            createdById: user.id,
            lineItems: {
              create: createdPr.lineItems.map((li: any) => ({
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

        // PO Number is issued manually by custodian later (starts null)
        await tx.purchaseOrder.create({
          data: {
            poNumber: null,
            abstractId: abstract.id,
            orderType: createdPr.requestType === "JOB" ? "JOB" : "PURCHASE",
            fiscalYear: createdPr.fiscalYear,
            totalAmount: createdPr.totalAmount,
            status: "DRAFT",
            createdById: user.id,
            lineItems: {
              create: createdPr.lineItems.map((li: any) => ({
                description: li.description,
                unit: li.unit,
                quantity: li.quantity,
                unitPrice: li.unitCost,
                totalPrice: li.totalCost,
                sortOrder: li.sortOrder
              }))
            }
          } as any
        });
      } else {
        // Direct Acquisition: Skip RFQ & abstract, PO number is issued manually later (starts null)
        await tx.purchaseOrder.create({
          data: {
            poNumber: null,
            prId: createdPr.id,
            orderType: createdPr.requestType === "JOB" ? "JOB" : "PURCHASE",
            fiscalYear: createdPr.fiscalYear,
            totalAmount: createdPr.totalAmount,
            status: "DRAFT",
            createdById: user.id,
            lineItems: {
              create: createdPr.lineItems.map((li: any) => ({
                description: li.description,
                unit: li.unit,
                quantity: li.quantity,
                unitPrice: li.unitCost,
                totalPrice: li.totalCost,
                sortOrder: li.sortOrder
              }))
            }
          } as any
        });
      }

      return createdPr;
    });

    return NextResponse.json(pr, { status: 201 });
  } catch (error: any) {
    console.error("PR Creation Error:", error);
    return NextResponse.json({ error: "Failed to create Purchase Request" }, { status: 500 });
  }
}
