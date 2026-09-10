import * as Sentry from "@sentry/node";
import { prisma } from "./prisma";
import { classifyProduct } from "./product-classification";
import { recordSuggestion } from "./product-classification-metrics";
import { boss, registeredWorkers, CLASSIFY_PRODUCT_QUEUE } from "./queue";
import { getEnglishText } from "./localized-json";

async function classifyProductJob(productId: string) {
  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) return; // deleted/gone since enqueue — skip silently

    const result = await classifyProduct(
      getEnglishText(product.name),
      (product.description as { en?: string } | null)?.en,
    );
    await recordSuggestion(result.categoryId !== null, result.tags.length);

    await prisma.product.update({
      where: { id: productId },
      data: {
        aiSuggestedCategoryId: result.categoryId,
        aiSuggestedTags: result.tags,
        aiSuggestedAt: new Date(),
      },
    });
  } catch (error) {
    // Same visibility gap as the stock-snapshot job: pg-boss retries then
    // drops the job silently otherwise — log and capture so a failed
    // reclassification is visible, then re-throw to preserve pg-boss's own
    // retry/failure tracking.
    console.error("Product classification job failed:", productId, error);
    Sentry.captureException(error, { extra: { productId } });
    throw error;
  }
}

export async function registerProductClassificationWorker() {
  // See queue.ts's `registeredWorkers` comment — stops bun --hot's
  // unconditional re-call of this function on every dev save from stacking
  // up a duplicate boss.work() subscription for this queue.
  if (registeredWorkers.has(CLASSIFY_PRODUCT_QUEUE)) return;
  registeredWorkers.add(CLASSIFY_PRODUCT_QUEUE);

  await boss.work<{ productId: string }>(
    CLASSIFY_PRODUCT_QUEUE,
    { localConcurrency: 2 }, // throttle OpenAI concurrency for a bulk run
    async ([job]) => classifyProductJob(job.data.productId),
  );
}
