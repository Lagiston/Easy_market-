import { z } from "zod";
import { LANGUAGES, type Language, localizedNameSchema } from "./localized";

const DESCRIPTION_ERROR = "Description must be 1000 characters or fewer";
const PRICE_ERROR = "Price must be zero or a positive whole number";
const STOCK_ERROR = "Stock must be zero or a positive whole number";
const THRESHOLD_ERROR = "Low stock threshold must be zero or a positive whole number";
const CATEGORY_ERROR = "Category is required";

export const localizedDescriptionSchema = z
  .object({
    en: z.string(DESCRIPTION_ERROR).trim().max(1000, DESCRIPTION_ERROR).optional(),
    ar: z.string().trim().max(1000, DESCRIPTION_ERROR).optional(),
    sw: z.string().trim().max(1000, DESCRIPTION_ERROR).optional(),
    fr: z.string().trim().max(1000, DESCRIPTION_ERROR).optional(),
  })
  .superRefine((value, ctx) => {
    const hasTranslation = ["ar", "sw", "fr"].some((lang) => value[lang as Language]);
    if (hasTranslation && !value.en) {
      ctx.addIssue({
        code: "custom",
        path: ["en"],
        message: "English description is required when another language is provided",
      });
    }
  })
  .transform((value) => {
    const result: Partial<Record<Language, string>> = {};
    for (const lang of LANGUAGES) {
      if (value[lang]) result[lang] = value[lang];
    }
    return Object.keys(result).length > 0 ? (result as LocalizedDescription) : undefined;
  });

export type LocalizedDescription = { en: string } & Partial<Record<Exclude<Language, "en">, string>>;

export const createProductSchema = z.object({
  name: localizedNameSchema,
  // The transform collapses an all-empty description to `undefined`, and the
  // client submits that post-transform value — so the server must accept a
  // missing description too.
  description: localizedDescriptionSchema.optional(),
  price: z.number(PRICE_ERROR).int(PRICE_ERROR).min(0, PRICE_ERROR),
  stock: z.number(STOCK_ERROR).int(STOCK_ERROR).min(0, STOCK_ERROR),
  lowStockThreshold: z.number(THRESHOLD_ERROR).int(THRESHOLD_ERROR).min(0, THRESHOLD_ERROR),
  categoryId: z.string(CATEGORY_ERROR).trim().min(1, CATEGORY_ERROR),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Pre-transform shape (what the form fields hold before name/description are normalized).
export type CreateProductFormInput = z.input<typeof createProductSchema>;

export const updateProductSchema = createProductSchema;

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export type UpdateProductFormInput = z.input<typeof updateProductSchema>;

export const PRODUCT_SORT_FIELDS = ["name", "category", "price", "stock", "createdAt"] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const productListQuerySchema = z.object({
  sortBy: z.enum(PRODUCT_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(SORT_ORDERS).default("desc"),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
