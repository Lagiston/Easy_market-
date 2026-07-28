import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { staffReplySchema } from "@es-market/core";

// Staff review-moderation endpoints; mounted at /api in index.ts. ADMIN-only,
// same tier as the catalog routes — moderation is content management, not
// day-to-day agent work like orders/inquiries.
export const reviewsRouter = Router();

const adminReviewSelect = {
  id: true,
  authorName: true,
  rating: true,
  comment: true,
  verifiedPurchase: true,
  staffReply: true,
  staffReplyAt: true,
  createdAt: true,
  product: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} as const;

reviewsRouter.get("/reviews", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const reviews = await prisma.review.findMany({
    select: adminReviewSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json({ reviews });
});

// Hard delete — nothing references a review, and there's no restore flow, so
// soft delete would be speculative (per the soft-delete convention's "only
// hard-delete if nothing will ever need the deleted row" carve-out).
reviewsRouter.delete<{ id: string }>(
  "/reviews/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const deleted = await prisma.review.deleteMany({ where: { id: req.params.id } });
    if (deleted.count === 0) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    res.status(204).end();
  },
);

// Single public staff response, shown on the storefront under the customer's
// own review text — not a threaded conversation, so set/clear is all that's
// needed (no history of prior replies).
reviewsRouter.post<{ id: string }>(
  "/reviews/:id/reply",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = staffReplySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const updated = await prisma.review.updateMany({
      where: { id: req.params.id },
      data: { staffReply: parsed.data.reply, staffReplyAt: new Date() },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    const review = await prisma.review.findUniqueOrThrow({
      where: { id: req.params.id },
      select: adminReviewSelect,
    });
    res.json({ review });
  },
);

// Retracts a staff reply — nulls both fields together, back to "no reply yet".
reviewsRouter.delete<{ id: string }>(
  "/reviews/:id/reply",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const updated = await prisma.review.updateMany({
      where: { id: req.params.id },
      data: { staffReply: null, staffReplyAt: null },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    res.status(204).end();
  },
);
