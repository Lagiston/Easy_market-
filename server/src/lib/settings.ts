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
