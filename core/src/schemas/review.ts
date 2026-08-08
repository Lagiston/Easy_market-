import { z } from "zod";
import { sanitizeText } from "../sanitize";

export const AUTHOR_NAME_ERROR = "Name must be at least 2 characters";
export const AUTHOR_NAME_MAX_ERROR = "Name must be 100 characters or fewer";
export const RATING_ERROR = "Choose a rating from 1 to 5 stars";
// Single source of truth for the cap, referenced by both the schema below and
// the client's live character counter — so the counter can never drift out of
// sync with what the server actually enforces.
export const COMMENT_MAX_LENGTH = 1000;
export const COMMENT_MAX_ERROR = `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer`;
export const HEADLINE_MAX_LENGTH = 120;
export const HEADLINE_MAX_ERROR = `Headline must be ${HEADLINE_MAX_LENGTH} characters or fewer`;

// Storefront product review form → POST /api/storefront/products/:id/reviews.
// Guest-first like checkout: authorName is a free-text field, not tied to a
// customer account — the route soft-attaches customerId from a session cookie
// when one happens to be present (same optional-auth pattern as orders).
export const createReviewSchema = z.object({
  authorName: z
    .string(AUTHOR_NAME_ERROR)
    .trim()
    .min(2, AUTHOR_NAME_ERROR)
    .max(100, AUTHOR_NAME_MAX_ERROR)
    .transform(sanitizeText)
    // Sanitizing markup-only input can empty the value after the min check.
    .refine((value) => value.length >= 2, AUTHOR_NAME_ERROR),
  rating: z
    .number(RATING_ERROR)
    .int(RATING_ERROR)
    .min(1, RATING_ERROR)
    .max(5, RATING_ERROR),
  headline: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .trim()
      .max(HEADLINE_MAX_LENGTH, HEADLINE_MAX_ERROR)
      .transform(sanitizeText)
      .optional(),
  ),
  comment: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .trim()
      .max(COMMENT_MAX_LENGTH, COMMENT_MAX_ERROR)
      .transform(sanitizeText)
      .optional(),
  ),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// Same fields as create — a signed-in customer editing their own review
// (PUT /api/customer/reviews/:id) replaces authorName/rating/comment
// wholesale, same as updateCategorySchema mirrors createCategorySchema.
// verifiedPurchase is never touched by this: it's a creation-time snapshot
// (see the storefront POST route), not recomputed on edit.
export const updateReviewSchema = createReviewSchema;

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export type UpdateReviewFormInput = z.input<typeof updateReviewSchema>;

const PAGE_ERROR = "Page must be a positive whole number";

// The storefront review list grows with customer activity (unlike the
// catalog-bounded product list), so it's paginated from day one — the client
// renders a "show more" append flow rather than numbered pages.
export const REVIEWS_PAGE_SIZE = 10;

// "verified" isn't a sort value here — verified-only is a separate boolean
// filter (see reviewListQuerySchema.verifiedOnly) so it can combine with any
// of these three orderings, not replace them.
export const REVIEW_SORTS = ["newest", "highest", "lowest"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const reviewListQuerySchema = z.object({
  page: z.coerce.number(PAGE_ERROR).int(PAGE_ERROR).min(1, PAGE_ERROR).default(1),
  sort: z.enum(REVIEW_SORTS).default("newest"),
  // Query params are always strings — only the literal string "true" counts,
  // so an absent/malformed value safely falls back to "show everything"
  // rather than erroring.
  verifiedOnly: z.preprocess((value) => value === "true", z.boolean()),
});

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;

// Pre-transform shape (what the form fields hold before normalization).
export type CreateReviewFormInput = z.input<typeof createReviewSchema>;

export const STAFF_REPLY_ERROR = "Reply cannot be empty";
export const STAFF_REPLY_MAX_ERROR = "Reply must be 1000 characters or fewer";

// A single public staff response to a review (server/src/routes/reviews.ts),
// shown on the storefront under the customer's own text — not a threaded
// conversation, so there's no separate "reply to reply" schema.
export const staffReplySchema = z.object({
  reply: z
    .string(STAFF_REPLY_ERROR)
    .trim()
    .min(1, STAFF_REPLY_ERROR)
    .max(1000, STAFF_REPLY_MAX_ERROR)
    .transform(sanitizeText)
    .refine((value) => value.length > 0, STAFF_REPLY_ERROR),
});

export type StaffReplyInput = z.infer<typeof staffReplySchema>;

export type StaffReplyFormInput = z.input<typeof staffReplySchema>;
