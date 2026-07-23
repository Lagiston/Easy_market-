import * as Sentry from "@sentry/node";
import { prisma } from "./prisma";
import { boss, PRODUCT_STOCK_SNAPSHOT_QUEUE } from "./queue";

export async function takeProductStockSnapshot() {
  const soldOutProducts = await prisma.product.findMany({
    where: { deletedAt: null, stock: 0 },
    select: { id: true },
  });
  const soldOutProductIds = soldOutProducts.map((p) => p.id);
  const date = new Date(new Date().toISOString().slice(0, 10));

  await prisma.productStockSnapshot.upsert({
    where: { date },
    create: { date, soldOutCount: soldOutProductIds.length, soldOutProductIds },
    update: { soldOutCount: soldOutProductIds.length, soldOutProductIds },
  });
}

export async function registerProductStockSnapshotWorker() {
  await boss.work(PRODUCT_STOCK_SNAPSHOT_QUEUE, async () => {
    try {
      await takeProductStockSnapshot();
    } catch (error) {
      // pg-boss retries (retryLimit: 2) then drops the job silently — log
      // here so a failed day is at least visible, since the dashboard chart
      // itself has no way to distinguish "job failed" from "job hasn't run
      // yet" (both render as the null/no-data state).
      console.error("Product stock snapshot job failed:", error);
      Sentry.captureException(error);
      throw error;
    }
  });
}
