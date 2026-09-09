import type { Prisma } from "../generated/prisma/client";

// Every LocalizedName/LocalizedDescription JSON column (Product.name,
// Category.name, KbArticle.title, ...) is stored as `{ en: string, ... }`,
// but Prisma can't type a Json column beyond `Prisma.JsonValue` — every read
// site otherwise had to re-derive this same narrowing cast itself.
export function getEnglishText(value: Prisma.JsonValue, fallback = ""): string {
  return typeof value === "object" && value !== null && "en" in value
    ? String((value as { en: unknown }).en)
    : fallback;
}
