import { z } from "zod";
import { localizedNameSchema } from "./localized";

// Only one homepage row exists today — a second ("home_everyday") was
// tried and removed. Kept as an array (not a single literal) so a future
// row is just an addition here, not a schema shape change.
export const HOME_ROWS = ["look_good"] as const;

export type HomeRow = (typeof HOME_ROWS)[number];

export const createCategorySchema = z.object({
  name: localizedNameSchema,
  // "" (the form's "Not on homepage" sentinel) preprocesses to undefined,
  // same empty-string-to-undefined convention as assignedAgentId/size/color
  // — the route explicitly writes `homeRow ?? null` on both create and
  // update, so omitting the field always clears it rather than "leaving
  // unchanged".
  homeRow: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(HOME_ROWS).optional(),
  ),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export type CreateCategoryFormInput = z.input<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema;

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export type UpdateCategoryFormInput = z.input<typeof updateCategorySchema>;
