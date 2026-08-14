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
const SOCIAL_URL_ERROR = "Enter a valid link (starting with http:// or https://)";

// Store-wide settings kept in the `Setting` key-value table. `freeDeliveryThreshold`
// null means the free-delivery-above-total rule is disabled; `contactPhone`/
// `contactEmail`/`contactAddress`/`social*Url` null means "not configured yet"
// (hidden on the storefront contact page/footer, rather than shown blank).
export type StoreSettings = {
  deliveryFee: number;
  freeDeliveryThreshold: number | null;
  callAttemptsBeforeCancel: number;
  defaultLowStockThreshold: number;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  socialInstagramUrl: string | null;
  socialTiktokUrl: string | null;
  socialFacebookUrl: string | null;
  // WhatsApp is the one exception with a fallback: when unset, the storefront
  // still derives a wa.me link from contactPhone (buildWhatsAppLink) — see
  // client/src/lib/social-icons.tsx's getSocialLinks. Set this to override
  // that derived link (e.g. with a wa.me link carrying a preset message).
  socialWhatsappUrl: string | null;
};

// Shape returned by GET /storefront/settings — callAttemptsBeforeCancel and
// defaultLowStockThreshold are internal ops settings, never exposed to the
// (unauthenticated) storefront.
export type PublicStoreSettings = Pick<
  StoreSettings,
  | "deliveryFee"
  | "freeDeliveryThreshold"
  | "contactPhone"
  | "contactEmail"
  | "contactAddress"
  | "socialInstagramUrl"
  | "socialTiktokUrl"
  | "socialFacebookUrl"
  | "socialWhatsappUrl"
>;

export const DEFAULT_SETTINGS: StoreSettings = {
  deliveryFee: 0,
  freeDeliveryThreshold: null,
  callAttemptsBeforeCancel: 3,
  defaultLowStockThreshold: 10,
  contactPhone: null,
  contactEmail: null,
  contactAddress: null,
  socialInstagramUrl: null,
  socialTiktokUrl: null,
  socialFacebookUrl: null,
  socialWhatsappUrl: null,
};

// Same "" → undefined clear pattern as freeDeliveryThreshold above and
// Customer.address (core/src/schemas/customer.ts) — a blank field clears the
// setting back to null rather than being rejected as invalid.
const optionalTextSetting = () =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().transform(sanitizeText).optional(),
  );

// Same clear-on-blank pattern as optionalTextSetting, plus a plain .url()
// check — these are always meant to be full external links (a profile page,
// a wa.me link), never a same-site path like PromoBlock's ctaUrl.
const optionalSocialUrlSetting = () =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().max(300, SOCIAL_URL_ERROR).url(SOCIAL_URL_ERROR).optional(),
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
  socialInstagramUrl: optionalSocialUrlSetting(),
  socialTiktokUrl: optionalSocialUrlSetting(),
  socialFacebookUrl: optionalSocialUrlSetting(),
  socialWhatsappUrl: optionalSocialUrlSetting(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// Pre-transform shape (what the form fields hold), same convention as CreateProductFormInput.
export type UpdateSettingsFormInput = z.input<typeof updateSettingsSchema>;
