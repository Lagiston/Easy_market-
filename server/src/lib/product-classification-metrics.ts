import { prisma } from "./prisma";
import type { ProductClassificationField } from "@es-market/core";

// Fixed-id singleton row — see ProductClassificationMetric in schema.prisma.
const METRIC_ID = "singleton";

export async function recordSuggestion(categorySuggested: boolean, tagsSuggested: number) {
  await prisma.productClassificationMetric.upsert({
    where: { id: METRIC_ID },
    create: {
      id: METRIC_ID,
      categorySuggested: categorySuggested ? 1 : 0,
      tagsSuggested,
    },
    update: {
      // `undefined` leaves the counter untouched rather than incrementing it —
      // same "undefined means no-op on update" gotcha noted for KbArticle.
      categorySuggested: categorySuggested ? { increment: 1 } : undefined,
      tagsSuggested: tagsSuggested > 0 ? { increment: tagsSuggested } : undefined,
    },
  });
}

export async function recordAcceptance(field: ProductClassificationField) {
  await prisma.productClassificationMetric.upsert({
    where: { id: METRIC_ID },
    create: {
      id: METRIC_ID,
      categoryAccepted: field === "category" ? 1 : 0,
      tagsAccepted: field === "tag" ? 1 : 0,
    },
    update: {
      categoryAccepted: field === "category" ? { increment: 1 } : undefined,
      tagsAccepted: field === "tag" ? { increment: 1 } : undefined,
    },
  });
}

// Rates as rounded percentages; null (not 0) when nothing's been suggested
// yet, same convention as the dashboard's draftSuccessRate.
export async function getProductClassificationAcceptance() {
  const metric = await prisma.productClassificationMetric.findUnique({
    where: { id: METRIC_ID },
  });

  const category =
    metric && metric.categorySuggested > 0
      ? Math.round((metric.categoryAccepted / metric.categorySuggested) * 100)
      : null;
  const tags =
    metric && metric.tagsSuggested > 0
      ? Math.round((metric.tagsAccepted / metric.tagsSuggested) * 100)
      : null;

  return { category, tags };
}
