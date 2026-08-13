import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { getSiteContent } from "../lib/site-content";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { updateSiteContentSchema, SITE_CONTENT_KEYS } from "@es-market/core";

// Admin-editable body text for the storefront About/Policy pages; mounted at
// /api in index.ts.
export const siteContentRouter = Router();

// Public: the storefront About/Policy pages render this content directly.
siteContentRouter.get("/storefront/site-content", async (_req, res) => {
  res.json({ content: await getSiteContent() });
});

siteContentRouter.get("/site-content", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  res.json({ content: await getSiteContent() });
});

siteContentRouter.put(
  "/site-content",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = updateSiteContentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    await prisma.$transaction(
      SITE_CONTENT_KEYS.map((key) =>
        prisma.siteContent.upsert({
          where: { key },
          create: { key, value: parsed.data[key] },
          update: { value: parsed.data[key] },
        }),
      ),
    );

    res.json({ content: await getSiteContent() });
  },
);
