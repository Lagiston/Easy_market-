import { DraftStatus, MessageSender } from "../generated/prisma/client";
import { prisma } from "./prisma";

const METRICS_WINDOW_DAYS = 30;
// A sent reply within this fraction of the original draft's word count is
// treated as "little/no edit" — same class of pragmatic threshold as the
// LOW_CONFIDENCE_THRESHOLD in inquiry-classification.ts, not a precise
// linguistic measure.
const LITTLE_EDIT_SIMILARITY_THRESHOLD = 0.85;

function windowStart(days: number) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

// Sorensen-Dice coefficient over whitespace-split word tokens — cheap (no
// O(n*m) DP table like Levenshtein) and good enough to bucket "basically the
// same reply" vs "substantially rewritten" for a dashboard vanity metric.
function wordSimilarity(a: string, b: string): number {
  const wordsA = a.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = b.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (wordsA.length === 0 && wordsB.length === 0) return 1;
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const countsA = new Map<string, number>();
  for (const word of wordsA) countsA.set(word, (countsA.get(word) ?? 0) + 1);

  let overlap = 0;
  for (const word of wordsB) {
    const remaining = countsA.get(word) ?? 0;
    if (remaining > 0) {
      overlap += 1;
      countsA.set(word, remaining - 1);
    }
  }

  return (2 * overlap) / (wordsA.length + wordsB.length);
}

// Share of approved (sent) drafts from the last METRICS_WINDOW_DAYS that
// went out effectively as-written: SENT_UNEDITED always counts, and
// SENT_EDITED counts too when the sent text is still highly similar to the
// original draft. Rounded percentage; null when nothing's been approved yet
// in the window, same null-vs-zero convention as draftSuccessRate.
export async function getDraftLittleEditRate(): Promise<number | null> {
  const approvedDrafts = await prisma.message.findMany({
    where: {
      sender: MessageSender.AI_DRAFT,
      draftStatus: { in: [DraftStatus.SENT_UNEDITED, DraftStatus.SENT_EDITED] },
      createdAt: { gte: windowStart(METRICS_WINDOW_DAYS) },
    },
    select: {
      body: true,
      draftStatus: true,
      draftApprovals: { select: { body: true }, take: 1 },
    },
  });

  if (approvedDrafts.length === 0) return null;

  const littleEditCount = approvedDrafts.filter((draft) => {
    if (draft.draftStatus === DraftStatus.SENT_UNEDITED) return true;
    const sent = draft.draftApprovals[0];
    if (!sent) return false;
    return wordSimilarity(draft.body, sent.body) >= LITTLE_EDIT_SIMILARITY_THRESHOLD;
  }).length;

  return Math.round((littleEditCount / approvedDrafts.length) * 100);
}

// Average minutes between an inquiry being opened and the first reply the
// customer actually saw — a STAFF message, or an AI_DRAFT that was
// auto-resolved (also customer-visible, unlike a PENDING/DISCARDED draft).
// Only inquiries from the last METRICS_WINDOW_DAYS that already got such a
// reply are counted; an inquiry still waiting on a first response doesn't
// have a response time yet. Null when no inquiry in the window has one.
export async function getAvgFirstResponseMinutes(): Promise<number | null> {
  const inquiries = await prisma.inquiry.findMany({
    where: { createdAt: { gte: windowStart(METRICS_WINDOW_DAYS) } },
    select: {
      createdAt: true,
      messages: {
        where: {
          OR: [
            { sender: MessageSender.STAFF },
            { sender: MessageSender.AI_DRAFT, draftStatus: DraftStatus.AUTO_RESOLVED },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const responseTimesMs = inquiries
    .filter((inquiry) => inquiry.messages.length > 0)
    .map((inquiry) => inquiry.messages[0]!.createdAt.getTime() - inquiry.createdAt.getTime());

  if (responseTimesMs.length === 0) return null;

  const avgMs = responseTimesMs.reduce((sum, ms) => sum + ms, 0) / responseTimesMs.length;
  return Math.round(avgMs / 60_000);
}

// Orders placed in the trailing 7 days (rolling, not calendar-week-aligned).
export async function getOrdersThisWeek(): Promise<number> {
  return prisma.order.count({ where: { createdAt: { gte: windowStart(7) } } });
}

const MOST_WISHLISTED_LIMIT = 5;

// Top products by all-time wishlist save count — a demand signal for staff,
// not windowed like the metrics above: wishlist saves accumulate slowly at
// this store's scale, so a 30-day window would mostly show noise. Products
// with zero saves are omitted entirely rather than padded in with a 0 —
// there's nothing to rank, not a null-vs-zero case like the other metrics.
export async function getMostWishlistedProducts(): Promise<
  { id: string; name: string; wishlistCount: number }[]
> {
  const grouped = await prisma.wishlistItem.groupBy({
    by: ["productId"],
    _count: true,
    orderBy: { _count: { productId: "desc" } },
    take: MOST_WISHLISTED_LIMIT,
  });
  if (grouped.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) }, deletedAt: null },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, (p.name as { en: string }).en]));

  // Preserves the count-ranked order from groupBy; a product that's since
  // been soft-deleted is dropped rather than shown with a placeholder name —
  // unlike the sold-out-history dialog (a historical record of a specific
  // past day), this is a live demand signal, so a deleted product just isn't
  // relevant to rank anymore.
  return grouped
    .filter((g) => nameById.has(g.productId))
    .map((g) => ({
      id: g.productId,
      name: nameById.get(g.productId)!,
      wishlistCount: g._count,
    }));
}
