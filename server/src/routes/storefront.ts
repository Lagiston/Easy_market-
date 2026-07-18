import { Router } from "express";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import {
  storefrontProductListQuerySchema,
  STOREFRONT_PAGE_SIZE,
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
  imageUrl: true,
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
  const { categoryId, minPrice, maxPrice, sort, page } = parsed.data;

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(categoryId ? { categoryId } : {}),
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

storefrontRouter.get("/storefront/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ categories });
});
