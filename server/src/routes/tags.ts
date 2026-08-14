import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { upsertTagSchema } from "@es-market/core";

// Admin-only CRUD for Tag translations — mirrors categories.ts, minus image
// handling (a tag has no image). Mounted at /api in index.ts.
export const tagsRouter = Router();

tagsRouter.get("/tags", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const tags = await prisma.tag.findMany({ orderBy: { value: "asc" } });
  res.json({ tags });
});

tagsRouter.post("/tags", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = upsertTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { value, name } = parsed.data;

  const existing = await prisma.tag.findUnique({ where: { value } });
  if (existing) {
    res.status(409).json({ error: "This tag already has a translation entry" });
    return;
  }

  const tag = await prisma.tag.create({ data: { value, name } });
  res.status(201).json({ tag });
});

// value is the id and never renamed — only its translated name is editable.
// The body still carries `value` (validated to match the URL param) so the
// same upsertTagSchema/form can drive both create and edit.
tagsRouter.put<{ value: string }>(
  "/tags/:value",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = upsertTagSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const { value, name } = parsed.data;
    if (value !== req.params.value) {
      res.status(400).json({ error: "A tag's value cannot be changed" });
      return;
    }

    const target = await prisma.tag.findUnique({ where: { value } });
    if (!target) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }

    const tag = await prisma.tag.update({ where: { value }, data: { name } });
    res.json({ tag });
  },
);

tagsRouter.delete<{ value: string }>(
  "/tags/:value",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const target = await prisma.tag.findUnique({ where: { value: req.params.value } });
    if (!target) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    await prisma.tag.delete({ where: { value: req.params.value } });
    res.status(204).end();
  },
);
