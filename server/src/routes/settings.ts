import { Router } from "express";
import { Role, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { getSettings } from "../lib/settings";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { updateSettingsSchema } from "@es-market/core";

// Store settings endpoints; mounted at /api in index.ts.
export const settingsRouter = Router();

// Public: checkout needs the delivery fee and free-delivery threshold to show totals.
settingsRouter.get("/storefront/settings", async (_req, res) => {
  res.json({ settings: await getSettings() });
});

settingsRouter.get("/settings", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  res.json({ settings: await getSettings() });
});

settingsRouter.put("/settings", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { deliveryFee, freeDeliveryThreshold } = parsed.data;

  const entries = [
    { key: "deliveryFee", value: deliveryFee as Prisma.InputJsonValue },
    {
      key: "freeDeliveryThreshold",
      value: freeDeliveryThreshold ?? Prisma.JsonNull,
    },
  ];
  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );

  res.json({ settings: await getSettings() });
});
