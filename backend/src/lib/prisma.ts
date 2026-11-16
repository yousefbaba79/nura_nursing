import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";

// D1 is only reachable through the binding Cloudflare injects per-request
// (env.DB), so unlike a Node process there's no module-level singleton to
// create at import time. Each request gets its own PrismaClient backed by
// that request's binding.
export function createPrismaClient(db: D1Database) {
  const adapter = new PrismaD1(db);
  return new PrismaClient({ adapter });
}

export type Prisma = ReturnType<typeof createPrismaClient>;
