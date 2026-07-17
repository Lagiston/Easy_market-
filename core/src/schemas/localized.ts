import { z } from "zod";

export const LANGUAGES = ["en", "ar", "sw", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];

const NAME_ERROR = "Name must be at least 2 characters";

// English required; Arabic, Swahili, French optional with English fallback.
export const localizedNameSchema = z
  .object({
    en: z.string(NAME_ERROR).trim().min(2, NAME_ERROR),
    ar: z.string().trim().optional(),
    sw: z.string().trim().optional(),
    fr: z.string().trim().optional(),
  })
  .transform((value) => {
    const result: { en: string } & Partial<Record<Exclude<Language, "en">, string>> = {
      en: value.en,
    };
    for (const lang of ["ar", "sw", "fr"] as const) {
      if (value[lang]) result[lang] = value[lang];
    }
    return result;
  });

export type LocalizedName = z.infer<typeof localizedNameSchema>;
