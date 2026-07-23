import { Router } from "express";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import {
  storefrontProductListQuerySchema,
  STOREFRONT_PAGE_SIZE,
  LANGUAGES,
  type StorefrontProductSort,
} from "@es-market/core";

// Public storefront endpoints — no auth; these serve the customer-facing catalog.
// Mounted at /api in index.ts.
export const storefrontRouter = Router();

// Only catalog-facing fields: internal fields like lowStockThreshold stay private.
const publicProductSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  images: true,
  tags: true,
  category: { select: { id: true, name: true } },
} as const;

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
  const { search, categoryId, tag, minPrice, maxPrice, sort, page } = parsed.data;

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

  res.json({ products, total, page, pageSize: STOREFRONT_PAGE_SIZE });
});

storefrontRouter.get<{ id: string }>("/storefront/products/:id", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, deletedAt: null },
    select: publicProductSelect,
  });
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json({ product });
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
