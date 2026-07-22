import { Router } from "express";
import { DraftStatus, InquiryStatus, MessageSender, Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";

// Admin dashboard overview counts; mounted at /api in index.ts.
export const dashboardRouter = Router();

dashboardRouter.get(
  "/dashboard/stats",
  requireAuth,
  requireRole(Role.ADMIN),
  async (_req, res) => {
    const [products, orders, lowStock, openInquiries, escalatedInquiries, draftStatusCounts] =
      await Promise.all([
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
      stats: { products, orders, lowStock, openInquiries, escalatedInquiries, draftSuccessRate },
    });
  },
);
