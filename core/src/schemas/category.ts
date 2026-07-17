import { z } from "zod";
import { localizedNameSchema } from "./localized";

export const createCategorySchema = z.object({
  name: localizedNameSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export type CreateCategoryFormInput = z.input<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema;

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export type UpdateCategoryFormInput = z.input<typeof updateCategorySchema>;
