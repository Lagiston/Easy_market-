import { randomUUID } from "node:crypto";
import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { OrderStatus, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { customerAuth } from "../lib/customer-auth";
import {
  storefrontProductListQuerySchema,
  createReviewSchema,
  reviewListQuerySchema,
  REVIEWS_PAGE_SIZE,
  STOREFRONT_PAGE_SIZE,
  LANGUAGES,
  type StorefrontProductSort,
  type ReviewSort,
} from "@es-market/core";

// Public storefront endpoints — no auth; these serve the customer-facing catalog.
// Mounted at /api in index.ts.
export const storefrontRouter = Router();

// Only catalog-facing fields: internal fields like lowStockThreshold stay
// private. Exported for reuse by the customer wishlist routes in
// customer.ts, which return the same product shape.
export const publicProductSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  salePrice: true,
  stock: true,
  lowStockThreshold: true,
  images: true,
  tags: true,
  size: true,
  color: true,
  category: { select: { id: true, name: true } },
  createdAt: true,
} as const;

// Per-product review + wishlist summary for product cards — two grouped
// aggregates scoped to the ids on the current page, rather than denormalized
// counters on Product (which would need bookkeeping on every review/wishlist
// create-or-delete). averageRating is null (not 0) for an unreviewed
// product, the usual null-vs-zero convention; wishlistCount has no
// unknown/unset state to distinguish (like reviewCount), so it's always a
// plain number. wishlistCount is social proof only — how many *other*
// customers have this saved — never the viewer's own wishlist membership
// (that's WishlistButton's isWishlisted, a separate signed-in-only signal).
type ProductSummary = { averageRating: number | null; reviewCount: number; wishlistCount: number };

// Exported for reuse by the customer wishlist route in customer.ts, which
// returns the same StorefrontProduct-shaped objects and needs the same
// review/wishlist summary fields — see that route for details.
export async function attachProductSummaries<T extends { id: string }>(
  products: T[],
): Promise<(T & ProductSummary)[]> {
  const summaries = new Map<string, ProductSummary>();
  if (products.length > 0) {
    const productIds = products.map((product) => product.id);
    const [reviewGroups, wishlistGroups] = await Promise.all([
      prisma.review.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.wishlistItem.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _count: true,
      }),
    ]);
    for (const group of reviewGroups) {
      summaries.set(group.productId, {
        averageRating: group._avg.rating,
        reviewCount: group._count,
        wishlistCount: summaries.get(group.productId)?.wishlistCount ?? 0,
      });
    }
    for (const group of wishlistGroups) {
      summaries.set(group.productId, {
        averageRating: summaries.get(group.productId)?.averageRating ?? null,
        reviewCount: summaries.get(group.productId)?.reviewCount ?? 0,
        wishlistCount: group._count,
      });
    }
  }
  return products.map((product) => ({
    ...product,
    ...(summaries.get(product.id) ?? { averageRating: null, reviewCount: 0, wishlistCount: 0 }),
  }));
}

const SORT_ORDER_BY: Record<StorefrontProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  "price-asc": [{ price: "asc" }, { createdAt: "desc" }],
  "price-desc": [{ price: "desc" }, { createdAt: "desc" }],
};

storefrontRouter.get("/storefront/products", async (req, res) => {
  const parsed = storefrontProductListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { search, categoryId, tag, minPrice, maxPrice, sort, availability, page } = parsed.data;

  // Tags are a plain string array (no JSON/text-search support on them), so a
  // substring match needs the candidate tag values resolved in JS first, then
  // passed to `hasSome` — same two-step approach as the /storefront/tags
  // flattening below, just filtered to the ones matching the search term.
  let matchingTags: string[] = [];
  if (search) {
    const productsWithTags = await prisma.product.findMany({
      where: { deletedAt: null },
      select: { tags: true },
    });
    const query = search.toLowerCase();
    matchingTags = [
      ...new Set(productsWithTags.flatMap((product) => product.tags)),
    ].filter((existingTag) => existingTag.includes(query));
  }

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            ...LANGUAGES.flatMap((lang) => [
              { name: { path: [lang], string_contains: search, mode: "insensitive" as const } },
              {
                description: {
                  path: [lang],
                  string_contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                category: {
                  name: { path: [lang], string_contains: search, mode: "insensitive" as const },
                },
              },
            ]),
            ...(matchingTags.length > 0 ? [{ tags: { hasSome: matchingTags } }] : []),
          ],
        }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : {}),
    ...(availability === "inStock" ? { stock: { gt: 0 } } : {}),
    ...(availability === "onSale" ? { salePrice: { not: null } } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: publicProductSelect,
      orderBy: SORT_ORDER_BY[sort],
      skip: (page - 1) * STOREFRONT_PAGE_SIZE,
      take: STOREFRONT_PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    products: await attachProductSummaries(products),
    total,
    page,
    pageSize: STOREFRONT_PAGE_SIZE,
  });
});

storefrontRouter.get<{ id: string }>("/storefront/products/:id", async (req, res) => {
  // variantGroupId is only selected here (not in publicProductSelect, used
  // by the list route too) to resolve siblings below — it's never itself
  // included in the response, only the resolved relatedProducts are.
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: { ...publicProductSelect, variantGroupId: true },
  });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const { variantGroupId, ...publicProduct } = product;
  const relatedProducts = variantGroupId
    ? await prisma.product.findMany({
        where: { variantGroupId, deletedAt: null, id: { not: product.id } },
        select: publicProductSelect,
        orderBy: { createdAt: "asc" },
      })
    : [];
  // One combined summary lookup so the main product and its siblings share the
  // same shape (and query) — split back apart by position below.
  const [withSummary, ...relatedWithSummaries] = await attachProductSummaries([
    publicProduct,
    ...relatedProducts,
  ]);
  res.json({ product: withSummary, relatedProducts: relatedWithSummaries });
});

// Customer-facing review fields only — customerId stays private (it's an
// account identifier, not display content). Exported for reuse by the
// customer self-service edit/delete routes in customer.ts, which return the
// same shape.
export const publicReviewSelect = {
  id: true,
  authorName: true,
  rating: true,
  headline: true,
  comment: true,
  verifiedPurchase: true,
  staffReply: true,
  staffReplyAt: true,
  createdAt: true,
} as const;

// "verified" isn't a value here — verifiedOnly is a separate filter (see the
// route below) that combines with any of these three orderings.
const REVIEW_ORDER_BY: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }],
};

storefrontRouter.get<{ id: string }>("/storefront/products/:id/reviews", async (req, res) => {
  const parsed = reviewListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { page, sort, verifiedOnly } = parsed.data;
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: { id: true },
  });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Only used to compute isOwnReview below (so the client can show edit/delete
  // controls) — the raw customerId itself is never sent, same privacy stance
  // as publicReviewSelect already takes.
  const customerSession = await customerAuth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  // total/averageRating/ratingCounts always describe *every* review for the
  // product (unaffected by sort/verifiedOnly) — like a product listing's "4.5
  // stars, 120 ratings" staying fixed regardless of which filtered view of
  // the reviews you're looking at. matchingTotal is the separate, filtered
  // count that actually drives this view's "show more" pagination.
  const where = { productId: product.id };
  const matchingWhere = { ...where, ...(verifiedOnly ? { verifiedPurchase: true } : {}) };
  const [reviews, matchingTotal, aggregate, ratingGroups] = await Promise.all([
    prisma.review.findMany({
      where: matchingWhere,
      select: { ...publicReviewSelect, customerId: true },
      orderBy: REVIEW_ORDER_BY[sort],
      skip: (page - 1) * REVIEWS_PAGE_SIZE,
      take: REVIEWS_PAGE_SIZE,
    }),
    prisma.review.count({ where: matchingWhere }),
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
    prisma.review.groupBy({ by: ["rating"], where, _count: true }),
  ]);
  // Zero-filled so the client's distribution bars can render all five rows
  // without guarding against missing keys.
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const group of ratingGroups) {
    ratingCounts[group.rating] = group._count;
  }
  res.json({
    reviews: reviews.map(({ customerId, ...review }) => ({
      ...review,
      isOwnReview: customerId !== null && customerId === customerSession?.user.id,
    })),
    matchingTotal,
    total: aggregate._count,
    averageRating: aggregate._avg.rating,
    ratingCounts,
    page,
    pageSize: REVIEWS_PAGE_SIZE,
  });
});

storefrontRouter.post<{ id: string }>("/storefront/products/:id/reviews", async (req, res) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: { id: true },
  });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Soft/optional auth: reviews stay guest-submittable either way — if a valid
  // customer session cookie happens to be present, the review is linked to
  // that account, but nothing here requires or blocks on it (same pattern as
  // POST /storefront/orders).
  const customerSession = await customerAuth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  const customerId = customerSession?.user.id ?? null;

  // Point-in-time snapshot (like OrderItem's price/name): verified when the
  // signed-in customer has any non-cancelled order containing this product.
  // Guests are never verified — there's no identity to check purchases against.
  const verifiedPurchase =
    customerId !== null &&
    (await prisma.order.findFirst({
      where: {
        customerId,
        status: { not: OrderStatus.CANCELLED },
        items: { some: { productId: product.id } },
      },
      select: { id: true },
    })) !== null;

  const { authorName, rating, headline, comment } = parsed.data;
  try {
    const review = await prisma.review.create({
      data: {
        id: randomUUID(),
        productId: product.id,
        customerId,
        authorName,
        rating,
        headline: headline ?? null,
        comment: comment ?? null,
        verifiedPurchase,
      },
      select: publicReviewSelect,
    });
    res.status(201).json({ review });
  } catch (err) {
    // The (customerId, productId) unique index — one review per product per
    // signed-in customer; race-safe where a pre-check findFirst wouldn't be.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "You have already reviewed this product" });
      return;
    }
    throw err;
  }
});

storefrontRouter.get("/storefront/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ categories });
});

// Distinct tags across the non-deleted catalog, for the storefront's tag
// filter dropdown. v1 simplification: flattened/deduped in JS rather than a
// dedicated SQL DISTINCT-on-array-elements query — fine at this catalog's
// expected scale (mirrors the same tradeoff already flagged for the AI
// classification prompt in product-classification.ts).
storefrontRouter.get("/storefront/tags", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { tags: true },
  });
  const tags = [...new Set(products.flatMap((product) => product.tags))].sort();
  res.json({ tags });
});

// Active promo blocks for the storefront homepage, ordered for display.
// Inactive/deleted ones are never sent — isActive is a visibility toggle
// distinct from deletedAt, but both are excluded here since neither should
// reach a customer.
storefrontRouter.get("/storefront/promo-blocks", async (_req, res) => {
  const now = new Date();
  const promoBlocks = await prisma.promoBlock.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      // A third, independent visibility gate on top of isActive — unset
      // startsAt/endsAt mean "no bound on that side", not "never/always show".
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    select: { id: true, headline: true, copy: true, ctaLabel: true, ctaUrl: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ promoBlocks });
});
