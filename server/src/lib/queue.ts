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
//
// Cached on globalThis for the same reason lib/prisma.ts's PrismaClient is —
// `bun --hot` re-runs this whole module graph on every dev save (a plain
// `app.listen` Express server, not `Bun.serve()`'s in-place hot-swap), so a
// bare module-level PgBoss would open a brand new connection pool on every
// reload without ever closing the previous one. globalThis survives that
// re-execution, so this only actually constructs a pool once per process.
const globalForBoss = globalThis as unknown as {
  boss?: PgBoss;
  bossStarted?: boolean;
  registeredWorkers?: Set<string>;
};

export const boss =
  globalForBoss.boss ??
  new PgBoss({
    connectionString: requiredEnv("DATABASE_URL"),
    connectionTimeoutMillis: 10_000,
  });

globalForBoss.boss = boss;

// Same globalThis-survives-hot-reload trick as `boss` itself, applied to
// worker registration: each register*Worker() (in the sibling *-job.ts
// files) is called unconditionally from index.ts's top-level code on every
// reload, so without this a duplicate `boss.work(...)` subscription would
// stack up per queue per reload — re-processing jobs redundantly and
// (each subscription holding its own poll connection) contributing to the
// same connection-pool growth `boss` itself used to cause. Keyed by queue
// name; register*Worker() functions check-and-add via `registeredWorkers`
// before calling `boss.work(...)`.
export const registeredWorkers = globalForBoss.registeredWorkers ?? new Set<string>();
globalForBoss.registeredWorkers = registeredWorkers;

export async function startQueue() {
  // startQueue() itself still re-runs on every hot reload (it's called from
  // index.ts's top-level code, which always re-executes) — this guard stops
  // it from re-registering the "error" listener and re-running boss.start()
  // against an already-started instance on every single save.
  if (globalForBoss.bossStarted) return;
  globalForBoss.bossStarted = true;

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
