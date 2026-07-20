import { Router } from "express";
import { InquiryStatus, Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";

// Admin dashboard overview counts; mounted at /api in index.ts.
export const dashboardRouter = Router();

dashboardRouter.get(
  "/dashboard/stats",
  requireAuth,
  requireRole(Role.ADMIN),
  async (_req, res) => {
    const [products, orders, lowStock, openInquiries, escalatedInquiries] = await Promise.all([
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
    ]);
    res.json({ stats: { products, orders, lowStock, openInquiries, escalatedInquiries } });
  },
);
