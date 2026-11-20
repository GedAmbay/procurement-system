import { prisma } from "@/lib/prisma";

/**
 * Line item description flow:
 *   PR  ──(auto, unless RFQ row was edited)──▶ RFQ ──(read live)──▶ Abstract
 *                                               │
 *                                               └─(auto, unless PO row was edited)──▶ PO ──(read live)──▶ Acceptance
 *
 * Rows are matched by `sortOrder`, which mirrors the PR row index.
 */

export interface DescriptionEdit {
  id: string;
  description: string;
}

/** Normalizes user-typed descriptions without destroying intentional line breaks. */
export function normalizeDescription(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
}

/**
 * Pushes the RFQ's (possibly edited) descriptions down to the Abstract line items and to
 * every PO line item that has not been manually edited on the PO itself.
 */
export async function propagateRfqDescriptions(rfqId: string, tx?: any): Promise<void> {
  const db = tx || prisma;

  const rfq = await db.rfq.findUnique({
    where: { id: rfqId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      abstract: {
        include: {
          lineItems: true,
          purchaseOrders: { include: { lineItems: true } },
        },
      },
    },
  });

  if (!rfq?.abstract) return;

  const descBySort = new Map<number, string>();
  for (const li of rfq.lineItems) descBySort.set(li.sortOrder, li.description);

  for (const ali of rfq.abstract.lineItems || []) {
    const desc = descBySort.get(ali.sortOrder);
    if (desc !== undefined && desc !== ali.description) {
      await db.abstractLineItem.update({ where: { id: ali.id }, data: { description: desc } });
    }
  }

  for (const po of rfq.abstract.purchaseOrders || []) {
    for (const pli of po.lineItems || []) {
      if (pli.descriptionEdited) continue;
      const desc = descBySort.get(pli.sortOrder);
      if (desc !== undefined && desc !== pli.description) {
        await db.poLineItem.update({ where: { id: pli.id }, data: { description: desc } });
      }
    }
  }
}

/**
 * Applies manual description edits to RFQ line items.
 * - Text equal to the PR text (or blank) clears the "edited" flag, so the row follows the PR again.
 * - Any other text is kept as an edit and remembers the PR text it was based on.
 *   Re-sending an unchanged edit therefore "confirms" it against the latest PR text.
 */
export async function applyRfqDescriptionEdits(
  rfqId: string,
  edits: DescriptionEdit[],
  tx?: any
): Promise<void> {
  const db = tx || prisma;
  if (!edits.length) return;

  const rfq = await db.rfq.findUnique({
    where: { id: rfqId },
    include: {
      lineItems: true,
      pr: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!rfq) return;

  const prItems: any[] = rfq.pr?.lineItems || [];

  for (const edit of edits) {
    const item = rfq.lineItems.find((li: any) => li.id === edit.id);
    if (!item) continue;

    const prDesc: string | undefined =
      prItems.find((p) => p.sortOrder === item.sortOrder)?.description ?? prItems[item.sortOrder]?.description;
    const typed = normalizeDescription(edit.description);
    const finalDesc = typed || prDesc || item.description;
    const isEdited = prDesc === undefined ? true : finalDesc !== prDesc;

    await db.rfqLineItem.update({
      where: { id: item.id },
      data: {
        description: finalDesc,
      },
    });
  }

  await propagateRfqDescriptions(rfqId, db);
}

/**
 * Applies manual description edits to PO line items (e.g. adding the supplier's brand/model).
 * The reference text is the RFQ row (or the PR row for direct acquisitions).
 */
export async function applyPoDescriptionEdits(
  poId: string,
  edits: DescriptionEdit[],
  tx?: any
): Promise<void> {
  const db = tx || prisma;
  if (!edits.length) return;

  const po = await db.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      lineItems: true,
      abstract: { include: { rfq: { include: { lineItems: true } } } },
      pr: { include: { lineItems: true } },
    },
  });
  if (!po) return;

  const refItems: any[] = po.abstract?.rfq?.lineItems || po.pr?.lineItems || [];

  for (const edit of edits) {
    const item = po.lineItems.find((li: any) => li.id === edit.id);
    if (!item) continue;

    const refDesc: string | undefined = refItems.find((r) => r.sortOrder === item.sortOrder)?.description;
    const typed = normalizeDescription(edit.description);
    const finalDesc = typed || refDesc || item.description;
    const isEdited = refDesc === undefined ? true : finalDesc !== refDesc;

    await db.poLineItem.update({
      where: { id: item.id },
      data: { description: finalDesc },
    });
  }
}

/** Validates an incoming `lineItemDescriptions` payload. */
export function parseDescriptionEdits(value: unknown): DescriptionEdit[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return [];
  return value
    .filter((v: any) => v && typeof v.id === "string" && typeof v.description === "string")
    .map((v: any) => ({ id: v.id, description: v.description }));
}
