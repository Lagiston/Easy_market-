import { z } from "zod";
import { sanitizeText } from "../sanitize";

const DELIVERY_FEE_ERROR = "Delivery fee must be zero or a positive whole number";
const FREE_DELIVERY_ERROR =
  "Free delivery threshold must be zero or a positive whole number";
const CALL_ATTEMPTS_ERROR = "Call attempts before cancel must be a whole number of at least 1";
const LOW_STOCK_DEFAULT_ERROR =
  "Default low stock threshold must be zero or a positive whole number";
const CONTACT_EMAIL_ERROR = "Enter a valid email address";
const CONTACT_PHONE_ERROR = "Phone number is too long";

// Store-wide settings kept in the `Setting` key-value table. `freeDeliveryThreshold`
// null means the free-delivery-above-total rule is disabled; `contactPhone`/
// `contactEmail`/`contactAddress` null means "not configured yet" (hidden on
// the storefront contact page, rather than shown blank).
export type StoreSettings = {
  deliveryFee: number;
  freeDeliveryThreshold: number | null;
  callAttemptsBeforeCancel: number;
  defaultLowStockThreshold: number;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
};

// Shape returned by GET /storefront/settings — callAttemptsBeforeCancel and
// defaultLowStockThreshold are internal ops settings, never exposed to the
// (unauthenticated) storefront.
export type PublicStoreSettings = Pick<
  StoreSettings,
  "deliveryFee" | "freeDeliveryThreshold" | "contactPhone" | "contactEmail" | "contactAddress"
>;

export const DEFAULT_SETTINGS: StoreSettings = {
  deliveryFee: 0,
  freeDeliveryThreshold: null,
  callAttemptsBeforeCancel: 3,
  defaultLowStockThreshold: 10,
  contactPhone: null,
  contactEmail: null,
  contactAddress: null,
};

// Same "" → undefined clear pattern as freeDeliveryThreshold above and
// Customer.address (core/src/schemas/customer.ts) — a blank field clears the
// setting back to null rather than being rejected as invalid.
const optionalTextSetting = () =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().transform(sanitizeText).optional(),
  );

export const updateSettingsSchema = z.object({
  deliveryFee: z
    .number(DELIVERY_FEE_ERROR)
    .int(DELIVERY_FEE_ERROR)
    .min(0, DELIVERY_FEE_ERROR),
  freeDeliveryThreshold: z.preprocess(
    (value) => (value === "" || value === null || Number.isNaN(value) ? undefined : value),
    z.number(FREE_DELIVERY_ERROR).int(FREE_DELIVERY_ERROR).min(0, FREE_DELIVERY_ERROR).optional(),
  ),
  callAttemptsBeforeCancel: z
    .number(CALL_ATTEMPTS_ERROR)
    .int(CALL_ATTEMPTS_ERROR)
    .min(1, CALL_ATTEMPTS_ERROR),
  defaultLowStockThreshold: z
    .number(LOW_STOCK_DEFAULT_ERROR)
    .int(LOW_STOCK_DEFAULT_ERROR)
    .min(0, LOW_STOCK_DEFAULT_ERROR),
  contactPhone: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().max(30, CONTACT_PHONE_ERROR).transform(sanitizeText).optional(),
  ),
  contactEmail: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z
      .string()
      .trim()
      .toLowerCase()
      .max(200, CONTACT_EMAIL_ERROR)
      .email(CONTACT_EMAIL_ERROR)
      .optional(),
  ),
  // Uncapped, same as Customer.address/Order.address — a physical address
  // isn't a bounded-length field the way an email or phone number is.
  contactAddress: optionalTextSetting(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// Pre-transform shape (what the form fields hold), same convention as CreateProductFormInput.
export type UpdateSettingsFormInput = z.input<typeof updateSettingsSchema>;
