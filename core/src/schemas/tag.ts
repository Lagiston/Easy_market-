import { z } from "zod";
import { localizedNameSchema } from "./localized";
import { tagSchema } from "./product";

// Tag.value is the same lowercased/trimmed string stored on Product.tags —
// reusing tagSchema keeps the two normalized identically, since a Tag row is
// only ever looked up by exact match against a product's stored tags.
export const upsertTagSchema = z.object({
  value: tagSchema,
  name: localizedNameSchema,
});

export type UpsertTagInput = z.infer<typeof upsertTagSchema>;

export type UpsertTagFormInput = z.input<typeof upsertTagSchema>;
