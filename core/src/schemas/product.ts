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
const VARIANT_LABEL_ERROR = "Must be 50 characters or fewer";

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
  // Free-text variant-distinguishing labels (e.g. "M", "Red") — not a list
  // like tags, since each product row is exactly one size/one color. Reuses
  // the same empty-string-to-undefined preprocessing as assignedAgentId so a
  // blank form field clears rather than storing "".
  size: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(50, VARIANT_LABEL_ERROR).optional(),
  ),
  color: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(50, VARIANT_LABEL_ERROR).optional(),
  ),
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

// Images are uploaded via a separate multipart endpoint (not this JSON
// schema), but both the client (to disable "add more" once full) and the
// server (to actually enforce it) need the same bound.
export const MAX_PRODUCT_IMAGES = 8;

// Body for POST /products/:id/variants — links another product into this
// product's variant group (e.g. a different color of the same item). Its
// own endpoint, like the image routes, rather than folded into
// create/updateProductSchema.
const VARIANT_PRODUCT_ID_ERROR = "A product id is required";
export const linkVariantSchema = z.object({
  productId: z.string(VARIANT_PRODUCT_ID_ERROR).trim().min(1, VARIANT_PRODUCT_ID_ERROR).max(100),
});

export type LinkVariantInput = z.infer<typeof linkVariantSchema>;

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
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().trim().min(1).optional(),
  // Lowercased for the same reason tagSchema is — stored tags are always
  // lowercase, so a differently-cased query param (e.g. a hand-typed URL)
  // would otherwise silently match nothing via the exact-match `has` filter.
  tag: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .transform((value) => value.toLowerCase())
    .optional(),
  minPrice: z.coerce.number(PRICE_ERROR).int(PRICE_ERROR).min(0, PRICE_ERROR).optional(),
  maxPrice: z.coerce.number(PRICE_ERROR).int(PRICE_ERROR).min(0, PRICE_ERROR).optional(),
  sort: z.enum(STOREFRONT_PRODUCT_SORTS).default("newest"),
  page: z.coerce.number(PAGE_ERROR).int(PAGE_ERROR).min(1, PAGE_ERROR).default(1),
});

export type StorefrontProductListQuery = z.infer<typeof storefrontProductListQuerySchema>;
