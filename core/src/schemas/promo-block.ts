import { z } from "zod";
import { localizedNameSchema } from "./localized";
import { localizedDescriptionSchema } from "./product";
import { sanitizeText } from "../sanitize";

const CTA_LABEL_ERROR = "CTA label must be 50 characters or fewer";
const CTA_URL_ERROR =
  "CTA link must be an absolute URL (https://example.com/sale) or an internal path (/products?tag=sale)";
const SORT_ORDER_ERROR = "Order must be zero or a positive whole number";
const CTA_LABEL_MAX = 50;

// Accepts either an internal path (rendered as a client-side <Link> on the
// storefront) or an absolute URL (rendered as an external <a>) — a plain
// z.string().url() would reject the internal-path case entirely.
function isValidCtaUrl(value: string): boolean {
  if (value.startsWith("/")) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// A CTA is optional as a whole, but if either half is filled the button
// wouldn't make sense without the other — label with nowhere to go, or a URL
// with no visible button text.
export const promoBlockSchema = z
  .object({
    headline: localizedNameSchema,
    copy: localizedDescriptionSchema.optional(),
    ctaLabel: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().trim().max(CTA_LABEL_MAX, CTA_LABEL_ERROR).optional(),
    ),
    ctaUrl: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().trim().refine(isValidCtaUrl, CTA_URL_ERROR).optional(),
    ),
    isActive: z.boolean(),
    sortOrder: z.number(SORT_ORDER_ERROR).int(SORT_ORDER_ERROR).min(0, SORT_ORDER_ERROR),
  })
  .superRefine((value, ctx) => {
    if (!!value.ctaLabel !== !!value.ctaUrl) {
      const missing = value.ctaLabel ? "ctaUrl" : "ctaLabel";
      ctx.addIssue({
        code: "custom",
        path: [missing],
        message:
          missing === "ctaUrl"
            ? "A CTA link is required when a CTA label is set"
            : "A CTA label is required when a CTA link is set",
      });
    }
  })
  .transform((value) => ({
    ...value,
    ctaLabel: value.ctaLabel ? sanitizeText(value.ctaLabel) : undefined,
  }));

export const createPromoBlockSchema = promoBlockSchema;

export type CreatePromoBlockInput = z.infer<typeof createPromoBlockSchema>;

// Pre-transform shape (what the form fields hold before headline/copy/CTA are normalized).
export type CreatePromoBlockFormInput = z.input<typeof createPromoBlockSchema>;

export const updatePromoBlockSchema = promoBlockSchema;

export type UpdatePromoBlockInput = z.infer<typeof updatePromoBlockSchema>;

export type UpdatePromoBlockFormInput = z.input<typeof updatePromoBlockSchema>;
