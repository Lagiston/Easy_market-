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

// Guarded raw UPDATE: increments the accepted counter only if it's still
// below its corresponding suggested counter, and only for an existing row.
// Comparing two columns of the same row can't be expressed through Prisma's
// `updateMany` filters (which only compare a column to a literal/parameter),
// so this is raw SQL — same class of "can't express in the DSL" case as
// kb-search.ts's tsvector queries. A single atomic UPDATE is race-safe,
// unlike a $transaction read-then-conditional-write, which has a TOCTOU race
// window between the read and the write under concurrent accept calls. This
// keeps an accepted counter from ever exceeding its suggested counter (which
// would push the dashboard's acceptance-rate stat past 100%) even if this
// endpoint is called more times than a real suggestion was ever shown — a
// deliberately lightweight clamp, not a full suggestion-correlation-token
// system, since this is a low-stakes internal admin-only vanity metric, not
// a security boundary. A row that doesn't exist yet (accept called before
// any recordSuggestion ever ran) matches zero rows and is a no-op.
export async function recordAcceptance(field: ProductClassificationField) {
  if (field === "category") {
    await prisma.$executeRaw`
      UPDATE "product_classification_metric"
      SET "categoryAccepted" = "categoryAccepted" + 1
      WHERE "id" = ${METRIC_ID} AND "categoryAccepted" < "categorySuggested"
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "product_classification_metric"
      SET "tagsAccepted" = "tagsAccepted" + 1
      WHERE "id" = ${METRIC_ID} AND "tagsAccepted" < "tagsSuggested"
    `;
  }
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
