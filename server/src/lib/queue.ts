import { PgBoss } from "pg-boss";
import { requiredEnv } from "./env";

// Postgres-backed job queue (pg-boss manages its own `pgboss` schema via
// boss.start()'s auto-migration — entirely separate from our Prisma-managed
// schema, so it's unaffected by the tsvector migration-drift gotcha).
export const CLASSIFY_PRODUCT_QUEUE = "classify-product";

export const boss = new PgBoss({ connectionString: requiredEnv("DATABASE_URL") });

export async function startQueue() {
  boss.on("error", (err: Error) => console.error("pg-boss error:", err));
  await boss.start();
  await boss.createQueue(CLASSIFY_PRODUCT_QUEUE, {
    retryLimit: 2,
    retryBackoff: true,
    retryDelay: 5,
  });
}
