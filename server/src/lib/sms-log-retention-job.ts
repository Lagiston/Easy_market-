import * as Sentry from "@sentry/node";
import { prisma } from "./prisma";
import { boss, SMS_LOG_RETENTION_QUEUE } from "./queue";

// SmsLog stores the full message body of every send attempt with no cap —
// fine at this store's current volume, but unbounded over time. Rather than
// add an admin-facing retention setting for a table nobody's asked to tune
// yet, this is a fixed 90-day window (long enough to cover any realistic
// "did we notify this customer" support/dispute lookback) pruned daily.
const RETENTION_DAYS = 90;

export async function pruneOldSmsLogs() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.smsLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}

export async function registerSmsLogRetentionWorker() {
  await boss.work(SMS_LOG_RETENTION_QUEUE, async () => {
    try {
      await pruneOldSmsLogs();
    } catch (error) {
      console.error("SmsLog retention job failed:", error);
      Sentry.captureException(error);
      throw error;
    }
  });
}
