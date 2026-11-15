import { PrismaClient } from "@prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  let url = process.env.DATABASE_URL;

  // For SQLite, ensure relative file URLs resolve to the actual database file in prisma/dev.db
  if (!url || url.startsWith("file:")) {
    const rawPath = url ? url.replace(/^file:/, "") : "./dev.db";
    // If it's a relative path, resolve it relative to the prisma directory
    if (!path.isAbsolute(rawPath)) {
      const dbPath = path.resolve(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
      url = `file:${dbPath}`;
    }
  }

  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: ["query"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
