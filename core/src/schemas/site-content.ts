import { z } from "zod";
import { sanitizeText } from "../sanitize";

// Editable body-text sections of the storefront's About and Policy pages,
// kept in the `SiteContent` key-value table (mirrors the `Setting`
// key/value/DEFAULT_SETTINGS pattern in settings.ts). Only body paragraphs
// are admin-editable — section headings/titles/CTA stay fixed in the
// client's i18n bundle, same "just the body text" scoping as everywhere
// else structure is meant to stay stable. English-only: matches how this
// prose is scoped elsewhere (hero content, About/Policy copy) — non-English
// storefront visitors keep seeing the existing static i18n translations,
// which will drift from future English edits here. An accepted v1 gap,
// same precedent as PromoBlock's Swahili/French fields staying
// schema-supported but not admin-editable.
export const SITE_CONTENT_KEYS = [
  "about_storyBody1",
  "about_storyBody2",
  "about_valueQualityBody",
  "about_valueServiceBody",
  "about_valueCommunityBody",
  "policy_returnsBody1",
  "policy_returnsBody2",
  "policy_privacyBody1",
  "policy_privacyBody2",
  "policy_termsBody1",
  "policy_termsBody2",
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

export type SiteContent = Record<SiteContentKey, string>;

export const SITE_CONTENT_BODY_MAX_LENGTH = 2000;
const SITE_CONTENT_BODY_REQUIRED_ERROR = "This field can't be empty";
const SITE_CONTENT_BODY_MAX_ERROR = `Must be ${SITE_CONTENT_BODY_MAX_LENGTH} characters or fewer`;

// The current shipped English copy — also the fallback for any key with no
// row yet (fresh DB, no seed required), same "missing row falls back to
// defaults" convention as getSettings().
export const DEFAULT_SITE_CONTENT: SiteContent = {
  "about_storyBody1":
    "Halatu started as a single physical shop, built on knowing our customers by name and making sure every order was right before it went out the door.",
  "about_storyBody2":
    "Bringing that same store online means the same care, just with a bigger doorstep — real people checking every order, real stock on the shelves, and a team that's actually reachable.",
  "about_valueQualityBody":
    "What you see is what's on the shelf — no phantom listings, no surprise substitutions.",
  "about_valueServiceBody":
    "Every order and every message is reviewed by someone on our team before it's confirmed or answered.",
  "about_valueCommunityBody":
    "Pay on delivery or pickup, local delivery, and support in the languages our customers actually speak.",
  "policy_returnsBody1":
    "Since you pay on delivery or pickup, you never pay before you've seen your order — if something's wrong, you can decline it on the spot and it won't be charged.",
  "policy_returnsBody2":
    "Staff confirm every order by phone before it goes out. If we can't reach you after a few attempts, the order is cancelled and any reserved stock is released automatically. You can also track an order's status any time using its order code and phone number.",
  "policy_privacyBody1":
    "We collect the name, phone number, and address you give us at checkout to fulfil and confirm your order — guest checkout is always available, and an account is never required to buy something.",
  "policy_privacyBody2":
    "If you create an account, we store your profile details (name, phone, address, and optional info like gender or region) so you can reorder faster and see your order history. We don't sell your data, and we don't have any email-based marketing or newsletter lists.",
  "policy_termsBody1":
    "Prices and stock shown on the site are what's actually available in-store; if something sells out between your order and our confirmation call, we'll let you know before charging you anything.",
  "policy_termsBody2":
    "There's currently no self-service password reset for customer accounts — if you're locked out, reach us via the Contact page and a staff member will help. Product reviews are moderated and may be removed if they violate common-sense guidelines (spam, abuse, or unrelated content).",
};

const siteContentBodyField = () =>
  z
    .string(SITE_CONTENT_BODY_REQUIRED_ERROR)
    .trim()
    .min(1, SITE_CONTENT_BODY_REQUIRED_ERROR)
    .max(SITE_CONTENT_BODY_MAX_LENGTH, SITE_CONTENT_BODY_MAX_ERROR)
    .transform(sanitizeText);

// Full-form submit (all keys at once), same shape as updateSettingsSchema —
// the admin page is one form with a Save button, not a per-field PATCH.
export const updateSiteContentSchema = z.object({
  "about_storyBody1": siteContentBodyField(),
  "about_storyBody2": siteContentBodyField(),
  "about_valueQualityBody": siteContentBodyField(),
  "about_valueServiceBody": siteContentBodyField(),
  "about_valueCommunityBody": siteContentBodyField(),
  "policy_returnsBody1": siteContentBodyField(),
  "policy_returnsBody2": siteContentBodyField(),
  "policy_privacyBody1": siteContentBodyField(),
  "policy_privacyBody2": siteContentBodyField(),
  "policy_termsBody1": siteContentBodyField(),
  "policy_termsBody2": siteContentBodyField(),
} satisfies Record<SiteContentKey, z.ZodType<string, string>>);

export type UpdateSiteContentInput = z.infer<typeof updateSiteContentSchema>;
