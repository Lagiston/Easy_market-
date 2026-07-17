import { z } from "zod";

const NAME_ERROR = "Name must be at least 2 characters";
const STOCK_ERROR = "Stock must be zero or a positive whole number";
const CATEGORY_ERROR = "Category is required";

export const createProductSchema = z.object({
  name: z.string(NAME_ERROR).trim().min(2, NAME_ERROR),
  stock: z.number(STOCK_ERROR).int(STOCK_ERROR).min(0, STOCK_ERROR),
  categoryId: z.string(CATEGORY_ERROR).trim().min(1, CATEGORY_ERROR),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema;

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
