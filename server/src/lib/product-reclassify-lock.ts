import { prisma } from "./prisma";

const LOCK_ID = "singleton";
const BATCH_TTL_MINUTES = 30;

// Guards against two "reclassify all" batches running concurrently. An
// atomic INSERT ... ON CONFLICT DO UPDATE ... WHERE — acquires the lock if
// no row exists yet, or if the previous lock has expired; otherwise the
// WHERE guard makes the conflict branch a no-op and RETURNING yields zero
// rows, so a second concurrent caller sees it wasn't acquired.
//
// TTL-based (not completion-triggered): pg-boss's own queue counters
// (boss.getQueue) turned out to be too laggy for this (confirmed live —
// several seconds behind actual enqueues, tried and rejected before this),
// and precisely detecting "all fan-out jobs finished" would need a pg-boss
// job flow (a dependent "batch done" job joining all N children) — real
// machinery disproportionate to what this guards (wasted duplicate compute
// + a display double-count, not a money/data-integrity issue). The 30-minute
// TTL is a generous ceiling for this store's catalog size; the tradeoff is a
// legitimately-finished batch can't be re-run until the TTL lapses. Not
// solved more precisely here, deliberately.
export async function acquireReclassifyLock(): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BATCH_TTL_MINUTES * 60 * 1000);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "product_reclassify_batch" ("id", "startedAt", "expiresAt")
    VALUES (${LOCK_ID}, ${now}, ${expiresAt})
    ON CONFLICT ("id") DO UPDATE
      SET "startedAt" = EXCLUDED."startedAt", "expiresAt" = EXCLUDED."expiresAt"
      WHERE "product_reclassify_batch"."expiresAt" < ${now}
    RETURNING "id"
  `;
  return rows.length > 0;
}
