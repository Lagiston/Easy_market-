import { z } from "zod";
import { localizedNameSchema } from "./localized";
import { localizedDescriptionSchema } from "./product";
import { sanitizeText } from "../sanitize";

const CTA_LABEL_ERROR = "CTA label must be 50 characters or fewer";
const CTA_URL_ERROR =
  "CTA link must be an absolute URL (https://example.com/sale) or an internal path (/products?tag=sale)";
const SORT_ORDER_ERROR = "Order must be zero or a positive whole number";
const DATE_ERROR = "Must be a valid date";
const END_BEFORE_START_ERROR = "End date must be on or after the start date";
const CTA_LABEL_MAX = 50;

// Date-only (no time) fields — form inputs are native <input type="date">,
// which give a "" empty string rather than never submitting the field at all.
// Kept as a validated string through the object schema (rather than
// z.coerce.date()) and only converted to a Date in the final .transform()
// below, to keep the overall schema's inferred type simple. Confirmed live:
// z.coerce.date() here pushed the client program's type-checking over some
// complexity threshold and produced *unrelated* spurious errors elsewhere in
// the client (better-auth's inferAdditionalFields losing the `role` field on
// SessionUser in Layout.tsx/ProtectedRoute.tsx) — reverting just this one
// field's type from coerced Date back to a plain validated string made both
// disappear, so avoid reintroducing z.coerce.date()/z.date() in this schema.
const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), DATE_ERROR)
    .optional(),
);

// Bumps a UTC-midnight instant to the last millisecond of that same day; a
// non-midnight instant (already end-of-day from a prior pass through this
// schema) is returned unchanged, making the adjustment idempotent.
function endOfDayOnce(date: Date): Date {
  const isMidnightUtc =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  return isMidnightUtc ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : date;
}

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
    startsAt: optionalDateSchema,
    endsAt: optionalDateSchema,
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
    if (value.startsAt && value.endsAt && new Date(value.endsAt) < new Date(value.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: END_BEFORE_START_ERROR });
    }
  })
  .transform((value) => ({
    ...value,
    ctaLabel: value.ctaLabel ? sanitizeText(value.ctaLabel) : undefined,
    startsAt: value.startsAt ? new Date(value.startsAt) : undefined,
    // A date-only end-date picker implies "show it through the end of that
    // day" — without this, the block would vanish at 00:00 UTC on the day
    // the admin picked as the last day it should still be visible. Only
    // applied to a fresh UTC-midnight value (i.e. not already end-of-day) —
    // this same schema runs twice per submission (client-side via
    // zodResolver, then again server-side on the client's already-transformed
    // JSON body), and adding a day is not idempotent, so re-running it on an
    // already-adjusted timestamp would silently push endsAt a further day
    // forward (caught live: a picked "Aug 5" end date round-tripped to "Aug
    // 6" on re-opening the edit dialog).
    endsAt: value.endsAt ? endOfDayOnce(new Date(value.endsAt)) : undefined,
  }));

export const createPromoBlockSchema = promoBlockSchema;

export type CreatePromoBlockInput = z.infer<typeof createPromoBlockSchema>;

// Pre-transform shape (what the form fields hold before headline/copy/CTA are normalized).
export type CreatePromoBlockFormInput = z.input<typeof createPromoBlockSchema>;

export const updatePromoBlockSchema = promoBlockSchema;

export type UpdatePromoBlockInput = z.infer<typeof updatePromoBlockSchema>;

export type UpdatePromoBlockFormInput = z.input<typeof updatePromoBlockSchema>;
