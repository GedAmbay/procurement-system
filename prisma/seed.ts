import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Offices ──────────────────────────────────────────────
  const officeAdmin = await prisma.office.upsert({
    where: { code: "ADMIN" },
    update: {},
    create: { name: "Office of the Mayor", code: "ADMIN", head: "Hon. Maria Santos" },
  });

  const officeBAC = await prisma.office.upsert({
    where: { code: "BAC" },
    update: {},
    create: { name: "Bids and Awards Committee", code: "BAC", head: "Engr. Jose Reyes" },
  });

  const officeHealth = await prisma.office.upsert({
    where: { code: "MHO" },
    update: {},
    create: { name: "Municipal Health Office", code: "MHO", head: "Dr. Ana Lim" },
  });

  const officeEngr = await prisma.office.upsert({
    where: { code: "MEO" },
    update: {},
    create: { name: "Municipal Engineering Office", code: "MEO", head: "Engr. Carlos Cruz" },
  });

  const officeFinance = await prisma.office.upsert({
    where: { code: "MTO" },
    update: {},
    create: { name: "Municipal Treasurer's Office", code: "MTO", head: "CPA Luz Bautista" },
  });

  console.log("✅ Offices created");

  // ─── Users ────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("Admin@1234", 12);

  await prisma.user.upsert({
    where: { email: "admin@pandan.gov.ph" },
    update: {},
    create: {
      name: "System Administrator",
      email: "admin@pandan.gov.ph",
      password: hashedPassword,
      role: "ADMIN",
      officeId: officeAdmin.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "bac@pandan.gov.ph" },
    update: {},
    create: {
      name: "BAC Secretariat",
      email: "bac@pandan.gov.ph",
      password: await bcrypt.hash("Bac@1234", 12),
      role: "BAC_SECRETARIAT",
      officeId: officeBAC.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "enduser@pandan.gov.ph" },
    update: {},
    create: {
      name: "Maria Santos",
      email: "enduser@pandan.gov.ph",
      password: await bcrypt.hash("User@1234", 12),
      role: "END_USER",
      officeId: officeHealth.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "budget@pandan.gov.ph" },
    update: {},
    create: {
      name: "CPA Luz Bautista",
      email: "budget@pandan.gov.ph",
      password: await bcrypt.hash("Budget@1234", 12),
      role: "BUDGET_OFFICER",
      officeId: officeFinance.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "supply@pandan.gov.ph" },
    update: {},
    create: {
      name: "Pedro Garcia",
      email: "supply@pandan.gov.ph",
      password: await bcrypt.hash("Supply@1234", 12),
      role: "SUPPLY_OFFICER",
      officeId: officeAdmin.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "mayor@pandan.gov.ph" },
    update: {},
    create: {
      name: "Hon. Ricardo Dela Cruz",
      email: "mayor@pandan.gov.ph",
      password: await bcrypt.hash("Mayor@1234", 12),
      role: "APPROVING_OFFICIAL",
      officeId: officeAdmin.id,
    },
  });

  console.log("✅ Users created");

  // ─── Signatories ──────────────────────────────────────────
  const signatoriesData = [
    { name: "Hon. Ricardo Dela Cruz", position: "Municipal Mayor / HOPE", role: "HOPE", officeId: officeAdmin.id },
    { name: "Engr. Jose Reyes", position: "BAC Chairperson", role: "BAC_CHAIRMAN", officeId: officeBAC.id },
    { name: "CPA Luz Bautista", position: "Municipal Treasurer / Budget Officer", role: "BUDGET_OFFICER", officeId: officeFinance.id },
    { name: "Pedro Garcia", position: "Supply / Property Officer", role: "SUPPLY_OFFICER", officeId: officeAdmin.id },
    { name: "Dr. Ana Lim", position: "Municipal Health Officer", role: "END_USER", officeId: officeHealth.id },
    { name: "Engr. Carlos Cruz", position: "Municipal Engineer", role: "END_USER", officeId: officeEngr.id },
  ];
  for (const sig of signatoriesData) {
    const existing = await prisma.signatory.findFirst({ where: { name: sig.name, role: sig.role } });
    if (!existing) await prisma.signatory.create({ data: sig });
  }
  console.log("✅ Signatories created");


  const suppliersData = [
    { name: "ABC Medical Supplies Corp.", philgepsNo: "PH-2024-001", tin: "123-456-789-000", address: "123 Maharlika Highway, Cabanatuan City, Nueva Ecija", contactPerson: "Juan Dela Cruz", contactNumber: "09171234567", email: "abc.medical@example.com" },
    { name: "XYZ Office Solutions Inc.", philgepsNo: "PH-2024-002", tin: "987-654-321-000", address: "456 Rizal Avenue, Palayan City, Nueva Ecija", contactPerson: "Elena Reyes", contactNumber: "09281234567", email: "xyz.office@example.com" },
    { name: "Mabuhay Hardware & Construction", philgepsNo: "PH-2024-003", tin: "111-222-333-000", address: "789 Quezon Street, Gapan City, Nueva Ecija", contactPerson: "Roberto Santos", contactNumber: "09391234567", email: "mabuhay.hardware@example.com" },
    { name: "Sunshine Trading & General Merchandise", philgepsNo: "PH-2024-004", tin: "444-555-666-000", address: "101 Burgos Street, San Jose City, Nueva Ecija", contactPerson: "Cynthia Lopez", contactNumber: "09501234567", email: "sunshine.trading@example.com" },
    { name: "Tagumpay IT Solutions", philgepsNo: "PH-2024-005", tin: "777-888-999-000", address: "202 Mabini Street, Munoz, Nueva Ecija", contactPerson: "Michael Tan", contactNumber: "09611234567", email: "tagumpay.it@example.com" },
  ];
  for (const s of suppliersData) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.supplier.create({ data: s });
  }

  console.log("✅ Suppliers created");

  // ─── Items / Catalog ─────────────────────────────────────
  const itemsData = [
    { code: "MED-001", description: "Paracetamol 500mg Tablet", unit: "Tablet", standardCost: 2.50, category: "Medicine" },
    { code: "MED-002", description: "Amoxicillin 500mg Capsule", unit: "Capsule", standardCost: 8.00, category: "Medicine" },
    { code: "MED-003", description: "Surgical Face Mask (3-ply)", unit: "Piece", standardCost: 5.00, category: "Medical Supplies" },
    { code: "MED-004", description: "Alcohol 70% Isopropyl 500ml", unit: "Bottle", standardCost: 85.00, category: "Medical Supplies" },
    { code: "MED-005", description: "Disposable Syringe 5ml", unit: "Piece", standardCost: 12.00, category: "Medical Supplies" },
    { code: "OFF-001", description: "Bond Paper A4 80gsm", unit: "Ream", standardCost: 220.00, category: "Office Supplies" },
    { code: "OFF-002", description: "Ballpoint Pen (Blue)", unit: "Piece", standardCost: 12.00, category: "Office Supplies" },
    { code: "OFF-003", description: "Folder Long (Pressboard)", unit: "Piece", standardCost: 25.00, category: "Office Supplies" },
    { code: "OFF-004", description: "Toner Cartridge (Compatible)", unit: "Piece", standardCost: 1200.00, category: "Office Supplies" },
    { code: "OFF-005", description: "Stapler Heavy Duty", unit: "Unit", standardCost: 350.00, category: "Office Supplies" },
    { code: "FUEL-001", description: "Diesel Fuel", unit: "Liter", standardCost: 68.00, category: "Fuel & Lubricants" },
    { code: "FUEL-002", description: "Gasoline (Regular)", unit: "Liter", standardCost: 65.00, category: "Fuel & Lubricants" },
    { code: "ENGR-001", description: "Portland Cement (40kg bag)", unit: "Bag", standardCost: 280.00, category: "Construction Materials" },
    { code: "ENGR-002", description: "Deformed Steel Bar 10mm x 6m", unit: "Piece", standardCost: 380.00, category: "Construction Materials" },
    { code: "ENGR-003", description: "Hollow Blocks (4x8x16)", unit: "Piece", standardCost: 18.00, category: "Construction Materials" },
  ];
  for (const item of itemsData) {
    const existing = await prisma.item.findUnique({ where: { code: item.code } });
    if (!existing) await prisma.item.create({ data: item });
  }

  console.log("✅ Items created");

  // ─── Fund Sources ─────────────────────────────────────────
  const fundSourcesData = [
    { name: "General Fund - MOOE", code: "GF-MOOE-2026", description: "Maintenance and Other Operating Expenses - General Fund", fiscalYear: 2026, totalBudget: 5000000.00 },
    { name: "General Fund - Capital Outlay", code: "GF-CO-2026", description: "Capital Outlay - General Fund", fiscalYear: 2026, totalBudget: 10000000.00 },
    { name: "Health Fund - MOOE", code: "HF-MOOE-2026", description: "Municipal Health Office Operating Budget", fiscalYear: 2026, totalBudget: 2500000.00 },
    { name: "20% Development Fund", code: "DF-2026", description: "20% Development Fund for Local Projects", fiscalYear: 2026, totalBudget: 8000000.00 },
    { name: "LDRRMF - Capital", code: "LDRRMF-CO-2026", description: "Local Disaster Risk Reduction and Management Fund", fiscalYear: 2026, totalBudget: 3000000.00 },
  ];
  for (const fs of fundSourcesData) {
    await prisma.fundSource.upsert({ where: { code: fs.code }, update: {}, create: fs });
  }

  console.log("✅ Fund sources created");

  // ─── Sample PR ────────────────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { email: "admin@pandan.gov.ph" } });
  const healthFund = await prisma.fundSource.findUnique({ where: { code: "HF-MOOE-2026" } });

  if (adminUser && healthFund) {
    const existingPR = await prisma.purchaseRequest.findUnique({ where: { prNumber: "PR-2026-09-0001" } });
    if (!existingPR) {
      await prisma.purchaseRequest.create({
        data: {
          prNumber: "PR-2026-09-0001",
          officeId: officeHealth.id,
          requestedById: adminUser.id,
          purpose: "Procurement of medical supplies for the Municipal Health Office for Q4 2026 operations",
          fundSourceId: healthFund.id,
          chargeToAccount: "5-02-03-010",
          totalAmount: 42500.00,
          status: "SUBMITTED",
          fiscalYear: 2026,
          lineItems: {
            create: [
              { description: "Paracetamol 500mg Tablet", unit: "Tablet", quantity: 5000, unitCost: 2.50, totalCost: 12500.00, sortOrder: 1 },
              { description: "Amoxicillin 500mg Capsule", unit: "Capsule", quantity: 1000, unitCost: 8.00, totalCost: 8000.00, sortOrder: 2 },
              { description: "Surgical Face Mask (3-ply)", unit: "Piece", quantity: 2000, unitCost: 5.00, totalCost: 10000.00, sortOrder: 3 },
              { description: "Alcohol 70% Isopropyl 500ml", unit: "Bottle", quantity: 100, unitCost: 85.00, totalCost: 8500.00, sortOrder: 4 },
              { description: "Disposable Syringe 5ml", unit: "Piece", quantity: 250, unitCost: 12.00, totalCost: 3000.00, sortOrder: 5 },
              { description: "Disposable Syringe 5ml", unit: "Piece", quantity: 500, unitCost: 1.0, totalCost: 500.00, sortOrder: 6 },
            ],
          },
        },
      });
      console.log("✅ Sample PR created");
    }
  }

  console.log("\n🎉 Seed completed successfully!");
  console.log("\n📋 Demo Login Credentials:");
  console.log("   Admin:     admin@pandan.gov.ph    / Admin@1234");
  console.log("   BAC:       bac@pandan.gov.ph      / Bac@1234");
  console.log("   End User:  enduser@pandan.gov.ph  / User@1234");
  console.log("   Budget:    budget@pandan.gov.ph   / Budget@1234");
  console.log("   Supply:    supply@pandan.gov.ph   / Supply@1234");
  console.log("   Mayor:     mayor@pandan.gov.ph    / Mayor@1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
