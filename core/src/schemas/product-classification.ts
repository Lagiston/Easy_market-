import { z } from "zod";

export const productClassificationRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
});

export type ProductClassificationRequest = z.infer<typeof productClassificationRequestSchema>;

// The exact shape GPT-5.6 Luna must return — passed directly as generateObject's
// schema. categoryId is nullable and validated against real, non-deleted
// categories server-side after generation (the model can't be trusted to only
// emit real ids), same principle as inquiryClassificationSchema.productId.
export const productClassificationSchema = z.object({
  categoryId: z.string().nullable(),
  // Lowercased to match the normalization createProductSchema applies to
  // stored tags — so a suggestion that gets applied as-is doesn't create a
  // near-duplicate of an existing tag that only differs in casing.
  tags: z
    .array(z.string().trim().min(1).max(50).transform((value) => value.toLowerCase()))
    .max(10),
  confidence: z.number().min(0).max(1),
});

export type ProductClassification = z.infer<typeof productClassificationSchema>;

export const PRODUCT_CLASSIFICATION_FIELDS = ["category", "tag"] as const;
export type ProductClassificationField = (typeof PRODUCT_CLASSIFICATION_FIELDS)[number];

export const productClassificationAcceptSchema = z.object({
  field: z.enum(PRODUCT_CLASSIFICATION_FIELDS),
});

export type ProductClassificationAcceptInput = z.infer<typeof productClassificationAcceptSchema>;

// Optimistic-concurrency token for dismissing a bulk-reclassify suggestion —
// the client sends back the aiSuggestedAt it last saw, so a suggestion
// recomputed by a concurrent bulk run in the meantime isn't silently
// discarded (see dismiss-suggestion's guarded updateMany in products.ts).
export const dismissProductSuggestionSchema = z.object({
  aiSuggestedAt: z.string().datetime(),
});

export type DismissProductSuggestionInput = z.infer<typeof dismissProductSuggestionSchema>;
