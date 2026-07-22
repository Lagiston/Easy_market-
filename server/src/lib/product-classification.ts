import { prisma } from "./prisma";
import { generateStructuredOutput } from "./ai";
import { productClassificationSchema, type ProductClassification } from "@es-market/core";

// v1 simplification: the whole non-deleted category list (id + English name)
// is sent in every classification prompt. Fine at expected scale (a handful to
// low dozens of categories); would need trimming if the catalog grows much
// larger. Not solved here — flagged, not silently ignored.
export async function classifyProduct(
  name: string,
  description?: string,
): Promise<ProductClassification> {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const catalog = categories
    .map((c) => `${c.id}: ${(c.name as { en: string }).en}`)
    .join("\n");

  const result = await generateStructuredOutput(
    productClassificationSchema,
    `Suggest a category and tags for this product. Pick the single best-matching ` +
      `category id from the list below (or null if none fit well), up to 10 short ` +
      `descriptive tags, and a confidence score (0-1).\n\n` +
      `Categories:\n${catalog}\n\n` +
      `Product name: ${name}\n` +
      `Description: ${description ?? "(none)"}`,
  );

  // The model can hallucinate ids — only trust a categoryId that's actually
  // in the catalog we sent it.
  const matchedCategory = categories.find((c) => c.id === result.categoryId);

  return {
    categoryId: matchedCategory?.id ?? null,
    tags: result.tags,
    confidence: result.confidence,
  };
}
