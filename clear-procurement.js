const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearProcurementData() {
  try {
    console.log("Deleting Acceptances...");
    await prisma.acceptance.deleteMany({});
    
    console.log("Deleting Purchase Orders...");
    await prisma.purchaseOrder.deleteMany({});
    
    console.log("Deleting Abstracts of Quotation...");
    await prisma.abstractOfQuotation.deleteMany({});
    
    console.log("Deleting RFQs...");
    await prisma.rfq.deleteMany({});
    
    console.log("Deleting Purchase Requests...");
    await prisma.purchaseRequest.deleteMany({});

    console.log("Deleting Document Audit Logs...");
    await prisma.documentAuditLog.deleteMany({});

    console.log("Successfully cleared all procurement documents!");
  } catch (error) {
    console.error("Error clearing data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearProcurementData();
