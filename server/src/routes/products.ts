import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createProductSchema } from "@es-market/core";

// Product and category endpoints; mounted at /api in index.ts.
export const productsRouter = Router();

const productInclude = {
  category: true,
} as const;

productsRouter.get("/categories", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json({ categories });
});

productsRouter.get("/products", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const products = await prisma.product.findMany({
    include: productInclude,
    orderBy: { createdAt: "asc" },
  });
  res.json({ products });
});

productsRouter.post("/products", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name, stock, categoryId } = parsed.data;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const product = await prisma.product.create({
    data: { id: randomUUID(), name, stock, categoryId },
    include: productInclude,
  });
  res.status(201).json({ product });
});
