import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";

// Admin dashboard overview counts; mounted at /api in index.ts.
export const dashboardRouter = Router();

dashboardRouter.get(
  "/dashboard/stats",
  requireAuth,
  requireRole(Role.ADMIN),
  async (_req, res) => {
    const [products, orders, lowStock] = await Promise.all([
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.order.count(),
      // Matches the client's getStockStatus: low stock excludes out-of-stock.
      prisma.product.count({
        where: {
          deletedAt: null,
          stock: { gt: 0, lt: prisma.product.fields.lowStockThreshold },
        },
      }),
    ]);
    res.json({ stats: { products, orders, lowStock } });
  },
);
