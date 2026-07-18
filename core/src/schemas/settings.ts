import { z } from "zod";

const DELIVERY_FEE_ERROR = "Delivery fee must be zero or a positive whole number";
const FREE_DELIVERY_ERROR =
  "Free delivery threshold must be zero or a positive whole number";

// Store-wide settings kept in the `Setting` key-value table. `freeDeliveryThreshold`
// null means the free-delivery-above-total rule is disabled.
export type StoreSettings = {
  deliveryFee: number;
  freeDeliveryThreshold: number | null;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  deliveryFee: 0,
  freeDeliveryThreshold: null,
};

export const updateSettingsSchema = z.object({
  deliveryFee: z
    .number(DELIVERY_FEE_ERROR)
    .int(DELIVERY_FEE_ERROR)
    .min(0, DELIVERY_FEE_ERROR),
  freeDeliveryThreshold: z.preprocess(
    (value) => (value === "" || value === null || Number.isNaN(value) ? undefined : value),
    z.number(FREE_DELIVERY_ERROR).int(FREE_DELIVERY_ERROR).min(0, FREE_DELIVERY_ERROR).optional(),
  ),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// Pre-transform shape (what the form fields hold), same convention as CreateProductFormInput.
export type UpdateSettingsFormInput = z.input<typeof updateSettingsSchema>;
