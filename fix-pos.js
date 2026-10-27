const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const abstracts = await prisma.abstractOfCanvass.findMany({
    where: { status: 'APPROVED' },
    include: { rfq: { include: { quotations: true } }, purchaseOrders: true }
  });

  for (const abstract of abstracts) {
    if (abstract.purchaseOrders.length > 0) {
      const po = abstract.purchaseOrders[0];
      if (!po.supplierId) {
        console.log(`PO ${po.poNumber} (from abstract ${abstract.abstractNumber}) has no supplier. Fixing...`);
        const validBids = abstract.rfq.quotations.filter(q => q.totalAmount > 0);
        if (validBids.length > 0) {
          const lowestBid = validBids.reduce((prev, current) => (prev.totalAmount < current.totalAmount) ? prev : current);
          await prisma.purchaseOrder.update({
            where: { id: po.id },
            data: { supplierId: lowestBid.supplierId }
          });
          console.log(`Assigned supplier ${lowestBid.supplierId} to PO ${po.poNumber}`);
        } else {
          console.log(`No valid bids found for abstract ${abstract.abstractNumber}`);
        }
      }
    }
  }
  console.log("Done.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
