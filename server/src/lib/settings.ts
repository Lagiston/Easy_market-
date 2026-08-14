import {
  DEFAULT_SETTINGS,
  FulfillmentType,
  type StoreSettings,
} from "@es-market/core";
import { prisma } from "./prisma";

// Missing rows (fresh DB) fall back to DEFAULT_SETTINGS — no seed required.
export async function getSettings(): Promise<StoreSettings> {
  const rows = await prisma.setting.findMany();
  const settings: StoreSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key === "deliveryFee" && typeof row.value === "number") {
      settings.deliveryFee = row.value;
    }
    if (row.key === "freeDeliveryThreshold") {
      settings.freeDeliveryThreshold = typeof row.value === "number" ? row.value : null;
    }
    if (row.key === "callAttemptsBeforeCancel" && typeof row.value === "number") {
      settings.callAttemptsBeforeCancel = row.value;
    }
    if (row.key === "defaultLowStockThreshold" && typeof row.value === "number") {
      settings.defaultLowStockThreshold = row.value;
    }
    if (row.key === "contactPhone") {
      settings.contactPhone = typeof row.value === "string" ? row.value : null;
    }
    if (row.key === "contactEmail") {
      settings.contactEmail = typeof row.value === "string" ? row.value : null;
    }
    if (row.key === "contactAddress") {
      settings.contactAddress = typeof row.value === "string" ? row.value : null;
    }
    if (row.key === "socialInstagramUrl") {
      settings.socialInstagramUrl = typeof row.value === "string" ? row.value : null;
    }
    if (row.key === "socialTiktokUrl") {
      settings.socialTiktokUrl = typeof row.value === "string" ? row.value : null;
    }
    if (row.key === "socialFacebookUrl") {
      settings.socialFacebookUrl = typeof row.value === "string" ? row.value : null;
    }
    if (row.key === "socialWhatsappUrl") {
      settings.socialWhatsappUrl = typeof row.value === "string" ? row.value : null;
    }
  }
  return settings;
}

export function computeDeliveryFee(
  subtotal: number,
  fulfillmentType: FulfillmentType,
  settings: StoreSettings,
): number {
  if (fulfillmentType === FulfillmentType.PICKUP) return 0;
  if (settings.freeDeliveryThreshold !== null && subtotal >= settings.freeDeliveryThreshold) {
    return 0;
  }
  return settings.deliveryFee;
}
