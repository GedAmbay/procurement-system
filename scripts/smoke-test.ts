import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

async function smokeTest() {
  console.log("=========================================");
  console.log("🚀 STARTING SUPABASE SMOKE TEST");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function report(name: string, success: boolean, detail?: string) {
    if (success) {
      console.log(`✅ [PASS] ${name}${detail ? ` - ${detail}` : ""}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Connection check
  try {
    const userCount = await prisma.user.count();
    report("Database Connection", true, `Found ${userCount} users`);
  } catch (err: any) {
    report("Database Connection", false, err.message);
  }

  // 2. Authentication Logic (NextAuth verify)
  try {
    const admin = await prisma.user.findUnique({
      where: { email: "admin@pandan.gov.ph" },
      include: { office: true },
    });

    if (!admin) {
      report("Auth Verify (Admin user found)", false, "admin@pandan.gov.ph not found");
    } else {
      const isPasswordValid = await bcrypt.compare("Admin@1234", admin.password);
      report("Auth Verify (Admin password check)", isPasswordValid, `Password match: ${isPasswordValid}`);
      report("User-Office Relation", !!admin.office, `Office: ${admin.office?.name}`);
    }
  } catch (err: any) {
    report("Auth Verify", false, err.message);
  }

  // 3. Query All Core Models
  try {
    const [offices, signatories, suppliers, items, fundSources, prs] = await Promise.all([
      prisma.office.count(),
      prisma.signatory.count(),
      prisma.supplier.count(),
      prisma.item.count(),
      prisma.fundSource.count(),
      prisma.purchaseRequest.count(),
    ]);

    report("Query Core Models", true, 
      `Offices: ${offices}, Signatories: ${signatories}, Suppliers: ${suppliers}, Items: ${items}, FundSources: ${fundSources}, PRs: ${prs}`);
  } catch (err: any) {
    report("Query Core Models", false, err.message);
  }

  // 4. Detailed PR with Relations (LineItems, FundSource, Office, RequestedBy)
  try {
    const samplePr = await prisma.purchaseRequest.findFirst({
      include: {
        lineItems: true,
        office: true,
        fundSource: true,
        requestedBy: true,
      },
    });

    if (samplePr) {
      report("PR Relations Loading", true, 
        `PR #${samplePr.prNumber} has ${samplePr.lineItems.length} line items, Fund: ${samplePr.fundSource?.code}, Office: ${samplePr.office?.name}`);
    } else {
      report("PR Relations Loading", false, "No sample PR found");
    }
  } catch (err: any) {
    report("PR Relations Loading", false, err.message);
  }

  // 5. Database Write & Delete Test (Transactional Integrity)
  try {
    const testSupplier = await prisma.supplier.create({
      data: {
        name: "Smoke Test Supplier Inc.",
        tin: "999-999-999-000",
        address: "Test St., Pandan",
        contactPerson: "Tester",
        email: "tester@example.com",
      },
    });

    report("Database Write", !!testSupplier.id, `Created supplier ID: ${testSupplier.id}`);

    await prisma.supplier.delete({
      where: { id: testSupplier.id },
    });

    report("Database Delete / Cleanup", true, "Test supplier successfully cleaned up");
  } catch (err: any) {
    report("Database Write / Delete", false, err.message);
  }

  console.log("\n=========================================");
  console.log(`SMOKE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

smokeTest()
  .catch((e) => {
    console.error("Unhandled error in smoke test:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
