import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createKbArticleSchema, updateKbArticleSchema, kbSearchQuerySchema } from "@es-market/core";
import { searchKbArticles } from "../lib/kb-search";

// KbArticle endpoints; mounted at /api in index.ts.
export const kbArticlesRouter = Router();

kbArticlesRouter.get("/kb-articles", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const kbArticles = await prisma.kbArticle.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json({ kbArticles });
});

// Verification/AI-retrieval-plumbing endpoint (not a client search feature —
// no search box in the admin KbArticles page). Registered before any future
// GET /kb-articles/:id route to avoid an :id/search path collision.
kbArticlesRouter.get(
  "/kb-articles/search",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = kbSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const results = await searchKbArticles(parsed.data.q, parsed.data.language);
    res.json({ kbArticles: results });
  },
);

kbArticlesRouter.post("/kb-articles", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createKbArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { title, body, topic } = parsed.data;

  const kbArticle = await prisma.kbArticle.create({
    data: { id: randomUUID(), title, body, topic },
  });
  res.status(201).json({ kbArticle });
});

kbArticlesRouter.put<{ id: string }>(
  "/kb-articles/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = updateKbArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const { title, body, topic } = parsed.data;
    const kbArticleId = req.params.id;

    const target = await prisma.kbArticle.findUnique({ where: { id: kbArticleId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Knowledge base article not found" });
      return;
    }

    const kbArticle = await prisma.kbArticle.update({
      // Prisma's `update` treats an `undefined` field as "leave unchanged", not
      // "clear it" — unlike `create`, where omitting it means NULL. Coerce to
      // `null` explicitly so clearing the topic in the form actually persists.
      where: { id: kbArticleId },
      data: { title, body, topic: topic ?? null },
    });
    res.json({ kbArticle });
  },
);

kbArticlesRouter.delete<{ id: string }>(
  "/kb-articles/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const kbArticleId = req.params.id;

    const target = await prisma.kbArticle.findUnique({ where: { id: kbArticleId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Knowledge base article not found" });
      return;
    }

    await prisma.kbArticle.update({ where: { id: kbArticleId }, data: { deletedAt: new Date() } });

    res.status(204).end();
  },
);
