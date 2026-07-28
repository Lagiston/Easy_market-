import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Role, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createPromoBlockSchema, updatePromoBlockSchema } from "@es-market/core";

// PromoBlock admin CRUD endpoints; mounted at /api in index.ts. The public,
// active-only storefront read lives in storefront.ts alongside the other
// unauthenticated GET routes.
export const promoBlocksRouter = Router();

promoBlocksRouter.get("/promo-blocks", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const promoBlocks = await prisma.promoBlock.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ promoBlocks });
});

promoBlocksRouter.post("/promo-blocks", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createPromoBlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { headline, copy, ctaLabel, ctaUrl, isActive, startsAt, endsAt, sortOrder } = parsed.data;

  const promoBlock = await prisma.promoBlock.create({
    data: { id: randomUUID(), headline, copy, ctaLabel, ctaUrl, isActive, startsAt, endsAt, sortOrder },
  });
  res.status(201).json({ promoBlock });
});

promoBlocksRouter.put<{ id: string }>(
  "/promo-blocks/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = updatePromoBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const { headline, copy, ctaLabel, ctaUrl, isActive, startsAt, endsAt, sortOrder } = parsed.data;
    const promoBlockId = req.params.id;

    const target = await prisma.promoBlock.findUnique({ where: { id: promoBlockId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Promo block not found" });
      return;
    }

    const promoBlock = await prisma.promoBlock.update({
      // Prisma's `update` treats an `undefined` field as "leave unchanged", not
      // "clear it" — coerce the clearable optional fields to `null` explicitly,
      // same as kb-articles.ts's `topic ?? null`.
      where: { id: promoBlockId },
      data: {
        headline,
        copy: copy ?? Prisma.JsonNull,
        ctaLabel: ctaLabel ?? null,
        ctaUrl: ctaUrl ?? null,
        isActive,
        startsAt: startsAt ?? null,
        endsAt: endsAt ?? null,
        sortOrder,
      },
    });
    res.json({ promoBlock });
  },
);

promoBlocksRouter.delete<{ id: string }>(
  "/promo-blocks/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const promoBlockId = req.params.id;

    const target = await prisma.promoBlock.findUnique({ where: { id: promoBlockId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Promo block not found" });
      return;
    }

    await prisma.promoBlock.update({ where: { id: promoBlockId }, data: { deletedAt: new Date() } });

    res.status(204).end();
  },
);
