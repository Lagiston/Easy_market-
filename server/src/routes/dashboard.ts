import { Router } from "express";
import { DraftStatus, InquiryStatus, MessageSender, Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { getProductClassificationAcceptance } from "../lib/product-classification-metrics";
import {
  getAvgFirstResponseMinutes,
  getDraftLittleEditRate,
  getOrdersThisWeek,
} from "../lib/dashboard-metrics";

// Admin dashboard overview counts; mounted at /api in index.ts.
export const dashboardRouter = Router();

dashboardRouter.get(
  "/dashboard/stats",
  requireAuth,
  requireRole(Role.ADMIN),
  async (_req, res) => {
    const [
      products,
      orders,
      lowStock,
      openInquiries,
      escalatedInquiries,
      draftStatusCounts,
      productClassificationAcceptance,
      avgFirstResponseMinutes,
      draftLittleEditRate,
      ordersThisWeek,
    ] = await Promise.all([
        prisma.product.count({ where: { deletedAt: null } }),
        prisma.order.count(),
        // Matches the client's getStockStatus: low stock excludes out-of-stock.
        prisma.product.count({
          where: {
            deletedAt: null,
            stock: { gt: 0, lt: prisma.product.fields.lowStockThreshold },
          },
        }),
        prisma.inquiry.count({ where: { status: InquiryStatus.OPEN } }),
        // Matches the nav badge's escalated signal: still escalated and not closed.
        prisma.inquiry.count({
          where: { status: { not: InquiryStatus.CLOSED }, escalatedAt: { not: null } },
        }),
        prisma.message.groupBy({
          by: ["draftStatus"],
          where: { sender: MessageSender.AI_DRAFT, draftStatus: { not: null } },
          _count: true,
        }),
        getProductClassificationAcceptance(),
        getAvgFirstResponseMinutes(),
        getDraftLittleEditRate(),
        getOrdersThisWeek(),
      ]);

    // Success rate = share of reviewed drafts (sent as-is or with edits) that
    // weren't discarded. PENDING drafts are excluded — they haven't been
    // judged yet, so counting them either way would understate/overstate the
    // rate. null (not 0) when nothing's been reviewed, so the client can show
    // "—" instead of a misleading 0%.
    const countFor = (status: DraftStatus) =>
      draftStatusCounts.find((c) => c.draftStatus === status)?._count ?? 0;
    const sent = countFor(DraftStatus.SENT_UNEDITED) + countFor(DraftStatus.SENT_EDITED);
    const discarded = countFor(DraftStatus.DISCARDED);
    const reviewed = sent + discarded;
    const draftSuccessRate = reviewed > 0 ? Math.round((sent / reviewed) * 100) : null;

    res.json({
      stats: {
        products,
        orders,
        lowStock,
        openInquiries,
        escalatedInquiries,
        draftSuccessRate,
        categorySuggestionAcceptanceRate: productClassificationAcceptance.category,
        tagSuggestionAcceptanceRate: productClassificationAcceptance.tags,
        avgFirstResponseMinutes,
        draftLittleEditRate,
        ordersThisWeek,
      },
    });
  },
);

dashboardRouter.get(
  "/dashboard/sold-out-history",
  requireAuth,
  requireRole(Role.ADMIN),
  async (_req, res) => {
    const days = 30;
    const today = new Date(new Date().toISOString().slice(0, 10));
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const snapshots = await prisma.productStockSnapshot.findMany({
      where: { date: { gte: start, lte: today } },
      orderBy: { date: "asc" },
    });
    const byDate = new Map(
      snapshots.map((s) => [s.date.toISOString().slice(0, 10), s.soldOutCount]),
    );

    // null (not 0) when no snapshot was recorded for that day — e.g. the
    // tracking job didn't exist yet — so the client can distinguish "no data"
    // from a confirmed zero sold-out count, instead of rendering a
    // misleading flat zero line for days before tracking began.
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      return { date: dateStr, soldOutCount: byDate.get(dateStr) ?? null };
    });

    const earliestSnapshot = await prisma.productStockSnapshot.findFirst({
      orderBy: { date: "asc" },
    });

    res.json({
      series,
      trackingStartDate: earliestSnapshot ? earliestSnapshot.date.toISOString().slice(0, 10) : null,
    });
  },
);

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

dashboardRouter.get(
  "/dashboard/sold-out-history/:date",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const dateParam = req.params.date;
    if (typeof dateParam !== "string" || !DATE_ONLY_PATTERN.test(dateParam)) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }
    const date = new Date(dateParam);
    if (Number.isNaN(date.getTime())) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }

    const snapshot = await prisma.productStockSnapshot.findUnique({ where: { date } });
    if (!snapshot) {
      res.status(404).json({ error: "No snapshot recorded for this date" });
      return;
    }

    // Products aren't hard-deleted, so every id should still resolve to a
    // row — but fall back defensively for any id that doesn't, same as the
    // inquiry-message source-article resolution (withResolvedSources).
    const products = await prisma.product.findMany({
      where: { id: { in: snapshot.soldOutProductIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(products.map((p) => [p.id, (p.name as { en: string }).en]));

    res.json({
      date: dateParam,
      products: snapshot.soldOutProductIds.map((id) => ({
        id,
        name: nameById.get(id) ?? "Deleted product",
      })),
    });
  },
);
