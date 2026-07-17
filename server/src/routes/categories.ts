import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createCategorySchema, updateCategorySchema, type LocalizedName } from "@es-market/core";

// Category endpoints; mounted at /api in index.ts.
export const categoriesRouter = Router();

async function findByEnglishName(en: string, excludeId?: string) {
  return prisma.category.findFirst({
    where: {
      deletedAt: null,
      name: { path: ["en"], equals: en },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

categoriesRouter.get("/categories", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const categories = await prisma.category.findMany({ where: { deletedAt: null } });
  categories.sort((a, b) => (a.name as LocalizedName).en.localeCompare((b.name as LocalizedName).en));
  res.json({ categories });
});

categoriesRouter.post("/categories", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name } = parsed.data;

  const existing = await findByEnglishName(name.en);
  if (existing) {
    res.status(409).json({ error: "A category with this English name already exists" });
    return;
  }

  const category = await prisma.category.create({
    data: { id: randomUUID(), name },
  });
  res.status(201).json({ category });
});

categoriesRouter.put<{ id: string }>(
  "/categories/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const { name } = parsed.data;
    const categoryId = req.params.id;

    const target = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const existing = await findByEnglishName(name.en, categoryId);
    if (existing) {
      res.status(409).json({ error: "A category with this English name already exists" });
      return;
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: { name },
    });
    res.json({ category });
  },
);

categoriesRouter.delete<{ id: string }>(
  "/categories/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const categoryId = req.params.id;

    const target = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    await prisma.category.update({ where: { id: categoryId }, data: { deletedAt: new Date() } });

    res.status(204).end();
  },
);
