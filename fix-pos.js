const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const aoqs = await prisma.abstractOfQuotation.findMany({
    where: { status: 'APPROVED' },
    include: { rfq: { include: { quotations: true } }, purchaseOrders: true }
  });

  for (const aoq of aoqs) {
    if (aoq.purchaseOrders.length > 0) {
      const po = aoq.purchaseOrders[0];
      if (!po.supplierId) {
        console.log(`PO ${po.poNumber} (from AOQ ${aoq.aoqNumber}) has no supplier. Fixing...`);
        const validBids = aoq.rfq.quotations.filter(q => q.totalAmount > 0);
        if (validBids.length > 0) {
            const lowestBid = validBids.reduce((prev, current) => (prev.totalAmount < current.totalAmount) ? prev : current);
            await prisma.purchaseOrder.update({
                where: { id: po.id },
                data: { supplierId: lowestBid.supplierId }
            });
            console.log(`Assigned supplier ${lowestBid.supplierId} to PO ${po.poNumber}`);
        } else {
            console.log(`No valid bids found for AOQ ${aoq.aoqNumber}`);
        }
      }
    }
  }
  console.log("Done.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
