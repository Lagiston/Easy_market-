import { prisma } from "./prisma";
import { classifyProduct } from "./product-classification";
import { recordSuggestion } from "./product-classification-metrics";
import { boss, CLASSIFY_PRODUCT_QUEUE } from "./queue";

async function classifyProductJob(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.deletedAt) return; // deleted/gone since enqueue — skip silently

  const result = await classifyProduct(
    (product.name as { en: string }).en,
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
}

export async function registerProductClassificationWorker() {
  await boss.work<{ productId: string }>(
    CLASSIFY_PRODUCT_QUEUE,
    { localConcurrency: 2 }, // throttle OpenAI concurrency for a bulk run
    async ([job]) => classifyProductJob(job.data.productId),
  );
}
