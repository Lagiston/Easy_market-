import { Router } from "express";
import { Role, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { getSettings } from "../lib/settings";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { updateSettingsSchema } from "@es-market/core";

// Store settings endpoints; mounted at /api in index.ts.
export const settingsRouter = Router();

// Public: checkout needs the delivery fee and free-delivery threshold to show
// totals, and the contact page needs the store's contact details.
// callAttemptsBeforeCancel/defaultLowStockThreshold are internal ops settings,
// not exposed here.
settingsRouter.get("/storefront/settings", async (_req, res) => {
  const {
    deliveryFee,
    freeDeliveryThreshold,
    contactPhone,
    contactEmail,
    contactAddress,
    socialInstagramUrl,
    socialTiktokUrl,
    socialFacebookUrl,
    socialWhatsappUrl,
  } = await getSettings();
  res.json({
    settings: {
      deliveryFee,
      freeDeliveryThreshold,
      contactPhone,
      contactEmail,
      contactAddress,
      socialInstagramUrl,
      socialTiktokUrl,
      socialFacebookUrl,
      socialWhatsappUrl,
    },
  });
});

// Any staff role (not just ADMIN) — Orders pages/dashboard need callAttemptsBeforeCancel
// to know when to offer the cancel-as-unreachable action, and that's AGENT-visible work.
settingsRouter.get("/settings", requireAuth, async (_req, res) => {
  res.json({ settings: await getSettings() });
});

settingsRouter.put("/settings", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const {
    deliveryFee,
    freeDeliveryThreshold,
    callAttemptsBeforeCancel,
    defaultLowStockThreshold,
    contactPhone,
    contactEmail,
    contactAddress,
    socialInstagramUrl,
    socialTiktokUrl,
    socialFacebookUrl,
    socialWhatsappUrl,
  } = parsed.data;

  const entries = [
    { key: "deliveryFee", value: deliveryFee as Prisma.InputJsonValue },
    {
      key: "freeDeliveryThreshold",
      value: freeDeliveryThreshold ?? Prisma.JsonNull,
    },
    { key: "callAttemptsBeforeCancel", value: callAttemptsBeforeCancel as Prisma.InputJsonValue },
    {
      key: "defaultLowStockThreshold",
      value: defaultLowStockThreshold as Prisma.InputJsonValue,
    },
    { key: "contactPhone", value: contactPhone ?? Prisma.JsonNull },
    { key: "contactEmail", value: contactEmail ?? Prisma.JsonNull },
    { key: "contactAddress", value: contactAddress ?? Prisma.JsonNull },
    { key: "socialInstagramUrl", value: socialInstagramUrl ?? Prisma.JsonNull },
    { key: "socialTiktokUrl", value: socialTiktokUrl ?? Prisma.JsonNull },
    { key: "socialFacebookUrl", value: socialFacebookUrl ?? Prisma.JsonNull },
    { key: "socialWhatsappUrl", value: socialWhatsappUrl ?? Prisma.JsonNull },
  ];
  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );

  res.json({ settings: await getSettings() });
});
