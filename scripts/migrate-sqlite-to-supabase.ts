// @ts-ignore
import { DatabaseSync } from "node:sqlite";
import { prisma } from "../lib/prisma";

async function migrate() {
  console.log("🚀 Starting data migration from SQLite (dev.db) to Supabase...\n");

  const sqlite = new DatabaseSync("prisma/dev.db");

  // Helper to parse dates & booleans
  function cleanRow(row: any, dateCols: string[] = [], boolCols: string[] = [], jsonCols: string[] = []) {
    const cleaned = { ...row };
    for (const col of dateCols) {
      if (cleaned[col]) {
        cleaned[col] = new Date(cleaned[col]);
      } else {
        cleaned[col] = null;
      }
    }
    for (const col of boolCols) {
      if (cleaned[col] !== undefined && cleaned[col] !== null) {
        cleaned[col] = Boolean(cleaned[col]);
      }
    }
    for (const col of jsonCols) {
      if (cleaned[col]) {
        try {
          if (typeof cleaned[col] === "string") {
            cleaned[col] = JSON.parse(cleaned[col]);
          }
        } catch {
          // keep as is
        }
      }
    }
    return cleaned;
  }

  console.log("🧹 Clearing temporary seed data from Supabase...");
  await prisma.documentAuditLog.deleteMany({});
  await prisma.acceptanceLineItem.deleteMany({});
  await prisma.acceptance.deleteMany({});
  await prisma.poLineItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.abstractLineItem.deleteMany({});
  await prisma.abstractOfCanvass.deleteMany({});
  await prisma.quotationLineItem.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.rfqSupplier.deleteMany({});
  await prisma.rfqLineItem.deleteMany({});
  await prisma.rfq.deleteMany({});
  await prisma.prLineItem.deleteMany({});
  await prisma.purchaseRequest.deleteMany({});
  await prisma.calendarEventHistory.deleteMany({});
  await prisma.calendarEvent.deleteMany({});
  await prisma.bacLeaveRecord.deleteMany({});
  await prisma.bacAttendance.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.signatory.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.fundSource.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.office.deleteMany({});
  console.log("✅ Cleaned existing tables.\n");

  // 1. Offices
  const offices = sqlite.prepare("SELECT * FROM offices").all();
  console.log(`Migrating ${offices.length} offices...`);
  for (const o of offices) {
    const data = cleanRow(o, ["createdAt", "updatedAt"], ["isActive"]);
    await prisma.office.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 2. Users
  const users = sqlite.prepare("SELECT * FROM users").all();
  console.log(`Migrating ${users.length} users...`);
  for (const u of users) {
    const data = cleanRow(u, ["createdAt", "updatedAt"], ["isActive"]);
    await prisma.user.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 3. Signatories
  const signatories = sqlite.prepare("SELECT * FROM signatories").all();
  console.log(`Migrating ${signatories.length} signatories...`);
  for (const s of signatories) {
    const data = cleanRow(s, ["createdAt", "updatedAt"], ["isActive"]);
    await prisma.signatory.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 4. Suppliers
  const suppliers = sqlite.prepare("SELECT * FROM suppliers").all();
  console.log(`Migrating ${suppliers.length} suppliers...`);
  for (const sup of suppliers) {
    const data = cleanRow(sup, ["createdAt", "updatedAt"], ["isActive"]);
    await prisma.supplier.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 5. Items
  const items = sqlite.prepare("SELECT * FROM items").all();
  console.log(`Migrating ${items.length} items...`);
  for (const it of items) {
    const data = cleanRow(it, ["createdAt", "updatedAt"], ["isActive"]);
    await prisma.item.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 6. Fund Sources
  const fundSources = sqlite.prepare("SELECT * FROM fund_sources").all();
  console.log(`Migrating ${fundSources.length} fund sources...`);
  for (const fs of fundSources) {
    const data = cleanRow(fs, ["createdAt", "updatedAt"], ["isActive"]);
    await prisma.fundSource.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 7. Purchase Requests
  const prs = sqlite.prepare("SELECT * FROM purchase_requests").all();
  console.log(`Migrating ${prs.length} purchase requests...`);
  for (const pr of prs) {
    const data = cleanRow(pr, ["lastPrintedAt", "createdAt", "updatedAt"], ["isDirectAcquisition"]);
    await prisma.purchaseRequest.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 8. PR Line Items
  const prLineItems = sqlite.prepare("SELECT * FROM pr_line_items").all();
  console.log(`Migrating ${prLineItems.length} PR line items...`);
  for (const item of prLineItems) {
    await prisma.prLineItem.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  // 9. RFQs
  const rfqs = sqlite.prepare("SELECT * FROM rfqs").all();
  console.log(`Migrating ${rfqs.length} RFQs...`);
  for (const rfq of rfqs) {
    const data = cleanRow(rfq, ["deadline", "lastPrintedAt", "createdAt", "updatedAt"]);
    await prisma.rfq.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 10. RFQ Line Items
  const rfqLineItems = sqlite.prepare("SELECT * FROM rfq_line_items").all();
  console.log(`Migrating ${rfqLineItems.length} RFQ line items...`);
  for (const item of rfqLineItems) {
    await prisma.rfqLineItem.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  // 10.5 RFQ Suppliers
  try {
    const rfqSuppliers = sqlite.prepare("SELECT * FROM rfq_suppliers").all();
    if (rfqSuppliers.length > 0) {
      console.log(`Migrating ${rfqSuppliers.length} RFQ suppliers...`);
      for (const rs of rfqSuppliers) {
        await prisma.rfqSupplier.upsert({
          where: { id: (rs as any).id },
          update: rs as any,
          create: rs as any,
        });
      }
    }
  } catch {}

  // 11. Quotations
  const quotations = sqlite.prepare("SELECT * FROM quotations").all();
  console.log(`Migrating ${quotations.length} quotations...`);
  for (const q of quotations) {
    const data = cleanRow(q, ["submittedAt", "createdAt", "updatedAt"]);
    await prisma.quotation.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 12. Quotation Line Items
  const qLineItems = sqlite.prepare("SELECT * FROM quotation_line_items").all();
  console.log(`Migrating ${qLineItems.length} quotation line items...`);
  for (const item of qLineItems) {
    const data = cleanRow(item, [], ["isLowest"]);
    await prisma.quotationLineItem.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 13. Abstracts of Canvass
  const abstracts = sqlite.prepare("SELECT * FROM abstracts_of_quotation").all();
  console.log(`Migrating ${abstracts.length} abstracts...`);
  for (const abs of abstracts) {
    const data = cleanRow(
      abs,
      ["lastPrintedAt", "createdAt", "updatedAt", "docDate", "dateReceived", "dateAwarded"],
      [],
      ["signatoriesData"]
    );
    await prisma.abstractOfCanvass.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 14. Abstract Line Items
  const absLineItems = sqlite.prepare("SELECT * FROM abstract_line_items").all();
  console.log(`Migrating ${absLineItems.length} abstract line items...`);
  for (const item of absLineItems) {
    await prisma.abstractLineItem.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  // 15. Purchase Orders
  const pos = sqlite.prepare("SELECT * FROM purchase_orders").all();
  console.log(`Migrating ${pos.length} purchase orders...`);
  for (const po of pos) {
    const data = cleanRow(po, ["deliveryDate", "lastPrintedAt", "createdAt", "updatedAt"]);
    await prisma.purchaseOrder.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 16. PO Line Items
  const poLineItems = sqlite.prepare("SELECT * FROM po_line_items").all();
  console.log(`Migrating ${poLineItems.length} PO line items...`);
  for (const item of poLineItems) {
    await prisma.poLineItem.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  // 17. Acceptances
  const acceptances = sqlite.prepare("SELECT * FROM acceptances").all();
  console.log(`Migrating ${acceptances.length} acceptances...`);
  for (const acc of acceptances) {
    const data = cleanRow(acc, ["invoiceDate", "dateReceived", "dateInspected", "createdAt", "updatedAt"]);
    data.airNumber = data.AIRNumber;
    delete data.AIRNumber;
    delete data.lastPrintedAt;
    await prisma.acceptance.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 18. Acceptance Line Items
  const accLineItems = sqlite.prepare("SELECT * FROM acceptance_line_items").all();
  console.log(`Migrating ${accLineItems.length} acceptance line items...`);
  for (const item of accLineItems) {
    await prisma.acceptanceLineItem.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  // 19. Calendar Events & History
  const events = sqlite.prepare("SELECT * FROM calendar_events").all();
  console.log(`Migrating ${events.length} calendar events...`);
  for (const ev of events) {
    const data = cleanRow(ev, ["eventDate", "createdAt", "updatedAt"]);
    await prisma.calendarEvent.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const histories = sqlite.prepare("SELECT * FROM calendar_event_history").all();
  console.log(`Migrating ${histories.length} calendar event histories...`);
  for (const h of histories) {
    const data = cleanRow(h, ["createdAt"]);
    await prisma.calendarEventHistory.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 20. BAC Attendance & Leaves
  const attendances = sqlite.prepare("SELECT * FROM bac_attendance").all();
  console.log(`Migrating ${attendances.length} BAC attendances...`);
  for (const a of attendances) {
    const data = cleanRow(a, ["date", "createdAt", "updatedAt"]);
    await prisma.bacAttendance.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const leaves = sqlite.prepare("SELECT * FROM bac_leave_records").all();
  console.log(`Migrating ${leaves.length} BAC leave records...`);
  for (const l of leaves) {
    const data = cleanRow(l, ["startDate", "endDate", "createdAt", "updatedAt"]);
    await prisma.bacLeaveRecord.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 21. Announcements
  const announcements = sqlite.prepare("SELECT * FROM announcements").all();
  console.log(`Migrating ${announcements.length} announcements...`);
  for (const ann of announcements) {
    const data = cleanRow(ann, ["createdAt", "updatedAt"], ["isPinned", "isArchived"]);
    await prisma.announcement.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // 22. Document Audit Logs
  const auditLogs = sqlite.prepare("SELECT * FROM document_audit_log").all();
  console.log(`Migrating ${auditLogs.length} audit logs...`);
  for (const log of auditLogs) {
    const data = cleanRow(log, ["createdAt"]);
    await prisma.documentAuditLog.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  console.log("\n🎉 ALL LOCAL DATA SUCCESSFULLY MIGRATED TO SUPABASE!");
}

migrate()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
