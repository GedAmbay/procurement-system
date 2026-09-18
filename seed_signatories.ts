import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.signatory.deleteMany()

  const sigs = [
    { name: "JEFFY S. CANGAYDA", position: "Municipal Engineer", role: "BAC_CHAIRMAN" },
    { name: "DELFIN D. PEÑAFLORIDA", position: "HRMO IV", role: "BAC_VICE_CHAIRMAN" },
    { name: "DANILO S. MARIANO", position: "Municipal Assessor", role: "BAC_MEMBER" },
    { name: "JEORGE GERICK C. UNTAL", position: "Engineer II", role: "BAC_MEMBER" },
    { name: "CARLOS O. SUAN, JR.", position: "PDO II", role: "BAC_MEMBER" },
    { name: "QUENNIE MAE T. CASIANO", position: "MPDC", role: "BAC_MEMBER" },
    { name: "HON. TOMAS U. ESTOPEREZ, JR.", position: "Municipal Mayor", role: "HOPE" }
  ]

  for (const s of sigs) {
    await prisma.signatory.create({ data: s })
  }
}

main()
