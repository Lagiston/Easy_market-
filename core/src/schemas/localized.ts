import { z } from "zod";
import { sanitizeText } from "../sanitize";

export const LANGUAGES = ["en", "ar", "sw", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];

const NAME_ERROR = "Name must be at least 2 characters";
const NAME_MAX_ERROR = "Name must be 225 characters or fewer";
const NAME_MAX = 225;

// English required; Arabic, Swahili, French optional with English fallback.
export const localizedNameSchema = z
  .object({
    en: z.string(NAME_ERROR).trim().min(2, NAME_ERROR).max(NAME_MAX, NAME_MAX_ERROR),
    ar: z.string().trim().max(NAME_MAX, NAME_MAX_ERROR).optional(),
    sw: z.string().trim().max(NAME_MAX, NAME_MAX_ERROR).optional(),
    fr: z.string().trim().max(NAME_MAX, NAME_MAX_ERROR).optional(),
  })
  .transform((value) => {
    const result: { en: string } & Partial<Record<Exclude<Language, "en">, string>> = {
      en: sanitizeText(value.en),
    };
    for (const lang of ["ar", "sw", "fr"] as const) {
      const clean = value[lang] ? sanitizeText(value[lang]) : undefined;
      if (clean) result[lang] = clean;
    }
    return result;
  })
  // Sanitizing can shorten markup-only input past the pre-transform min check —
  // fail those instead of storing an empty/too-short name.
  .refine((value) => value.en.length >= 2, { path: ["en"], message: NAME_ERROR });

export type LocalizedName = z.infer<typeof localizedNameSchema>;
