import { PgBoss } from "pg-boss";
import * as Sentry from "@sentry/node";
import { requiredEnv } from "./env";

// Postgres-backed job queue (pg-boss manages its own `pgboss` schema via
// boss.start()'s auto-migration — entirely separate from our Prisma-managed
// schema, so it's unaffected by the tsvector migration-drift gotcha).
export const CLASSIFY_PRODUCT_QUEUE = "classify-product";
export const PRODUCT_STOCK_SNAPSHOT_QUEUE = "product-stock-snapshot";
export const SMS_LOG_RETENTION_QUEUE = "sms-log-retention";

// connectionTimeoutMillis: pg-boss connects via node-postgres directly (not
// Prisma's own schema-engine binary, which has separate connection logic) —
// without an explicit timeout, a connection that never completes its TCP/TLS
// handshake hangs boss.start() forever with no error, which is
// indistinguishable from a slow start from the process's own logs.
export const boss = new PgBoss({
  connectionString: requiredEnv("DATABASE_URL"),
  connectionTimeoutMillis: 10_000,
});

export async function startQueue() {
  boss.on("error", (err: Error) => {
    console.error("pg-boss error:", err);
    Sentry.captureException(err);
  });
  await boss.start();
  await boss.createQueue(CLASSIFY_PRODUCT_QUEUE, {
    retryLimit: 2,
    retryBackoff: true,
    retryDelay: 5,
  });
  await boss.createQueue(PRODUCT_STOCK_SNAPSHOT_QUEUE, {
    retryLimit: 2,
    retryBackoff: true,
    retryDelay: 5,
  });
  await boss.createQueue(SMS_LOG_RETENTION_QUEUE, {
    retryLimit: 2,
    retryBackoff: true,
    retryDelay: 5,
  });
  // Daily snapshot of the sold-out product count, just after midnight UTC.
  await boss.schedule(PRODUCT_STOCK_SNAPSHOT_QUEUE, "5 0 * * *", {}, { tz: "UTC" });
  // Daily SmsLog prune, offset from the snapshot job above so they don't
  // contend for the same moment.
  await boss.schedule(SMS_LOG_RETENTION_QUEUE, "15 0 * * *", {}, { tz: "UTC" });
}
