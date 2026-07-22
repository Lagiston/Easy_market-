import { z } from "zod";
import { LANGUAGES, type Language, localizedNameSchema } from "./localized";
import { sanitizeText } from "../sanitize";

const DESCRIPTION_ERROR = "Description must be 1000 characters or fewer";
const PRICE_ERROR = "Price must be zero or a positive whole number";
const STOCK_ERROR = "Stock must be zero or a positive whole number";
const THRESHOLD_ERROR = "Low stock threshold must be zero or a positive whole number";
const CATEGORY_ERROR = "Category is required";
const PAGE_ERROR = "Page must be a positive whole number";
const TAG_ERROR = "Tags must be 50 characters or fewer";

// Lowercased so "Rice" and "rice" collapse to the same tag — otherwise the
// storefront tag filter and admin tag list fragment over near-duplicates that
// differ only in casing.
const tagSchema = z
  .string()
  .trim()
  .min(1, TAG_ERROR)
  .max(50, TAG_ERROR)
  .transform((value) => value.toLowerCase());

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
      const clean = value[lang] ? sanitizeText(value[lang]) : undefined;
      if (clean) result[lang] = clean;
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
  categoryId: z.string(CATEGORY_ERROR).trim().min(1, CATEGORY_ERROR).max(100, CATEGORY_ERROR),
  assignedAgentId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).max(100).optional(),
  ),
  tags: z
    .array(tagSchema)
    .max(10)
    .default([])
    .transform((tags) => Array.from(new Set(tags))),
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

export const PRODUCTS_PAGE_SIZE = 10;

export const productListQuerySchema = z.object({
  sortBy: z.enum(PRODUCT_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(SORT_ORDERS).default("desc"),
  search: z.string().trim().max(200).optional(),
  // Optional and undefaulted: omitting `page` means "return everything unpaginated"
  // (used by the dashboard's client-side-filtered overview), while the products
  // management page always sends an explicit page to get a paginated slice.
  page: z.coerce.number(PAGE_ERROR).int(PAGE_ERROR).min(1, PAGE_ERROR).optional(),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const reclassifyStatusQuerySchema = z.object({
  since: z.string().datetime(),
});

export type ReclassifyStatusQuery = z.infer<typeof reclassifyStatusQuerySchema>;

export const STOREFRONT_PRODUCT_SORTS = ["newest", "price-asc", "price-desc"] as const;
export type StorefrontProductSort = (typeof STOREFRONT_PRODUCT_SORTS)[number];

export const STOREFRONT_PAGE_SIZE = 12;

export const storefrontProductListQuerySchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  minPrice: z.coerce.number(PRICE_ERROR).int(PRICE_ERROR).min(0, PRICE_ERROR).optional(),
  maxPrice: z.coerce.number(PRICE_ERROR).int(PRICE_ERROR).min(0, PRICE_ERROR).optional(),
  sort: z.enum(STOREFRONT_PRODUCT_SORTS).default("newest"),
  page: z.coerce.number(PAGE_ERROR).int(PAGE_ERROR).min(1, PAGE_ERROR).default(1),
});

export type StorefrontProductListQuery = z.infer<typeof storefrontProductListQuerySchema>;
