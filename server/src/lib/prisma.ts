import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Cached on globalThis, not just a module-level const: `bun --hot` re-runs
// this whole entry module graph on every dev save (this app uses a plain
// `app.listen` Express server, not `Bun.serve()`'s in-place hot-swap), so a
// bare module-level singleton would construct a brand new PrismaPg — and
// therefore a brand new underlying pg.Pool — on every single reload without
// ever closing the previous one. `globalThis` survives module-graph
// invalidation, so caching there means only the first execution per process
// actually opens a pool; every later reload reuses it. Confirmed live: a
// multi-day dev server accumulated enough leaked pools to exhaust Postgres's
// max_connections ("sorry, too many clients already"), breaking every route.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10_000,
    }),
  });

globalForPrisma.prisma = prisma;
