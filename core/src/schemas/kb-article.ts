import { z } from "zod";
import { localizedNameSchema } from "./localized";
import { sanitizeText } from "../sanitize";

const BODY_ERROR = "Body must be 10000 characters or fewer";
const BODY_REQUIRED_ERROR = "Body is required";
const TOPIC_ERROR = "Topic must be 100 characters or fewer";
// ~1,500-2,000 words: room for a full KB answer, still bounds payload/tsvector cost.
const BODY_MAX = 10_000;
const TOPIC_MAX = 100;

// English required; Arabic, Swahili, French optional with English fallback —
// same shape as localizedNameSchema, sized for article prose rather than a title.
export const kbArticleBodySchema = z
  .object({
    en: z.string(BODY_REQUIRED_ERROR).trim().min(1, BODY_REQUIRED_ERROR).max(BODY_MAX, BODY_ERROR),
    ar: z.string().trim().max(BODY_MAX, BODY_ERROR).optional(),
    sw: z.string().trim().max(BODY_MAX, BODY_ERROR).optional(),
    fr: z.string().trim().max(BODY_MAX, BODY_ERROR).optional(),
  })
  .transform((value) => {
    const result: { en: string } & Partial<Record<"ar" | "sw" | "fr", string>> = {
      en: sanitizeText(value.en),
    };
    for (const lang of ["ar", "sw", "fr"] as const) {
      const clean = value[lang] ? sanitizeText(value[lang]) : undefined;
      if (clean) result[lang] = clean;
    }
    return result;
  })
  // Sanitizing can shorten markup-only input past the pre-transform min check —
  // fail those instead of storing an empty body.
  .refine((value) => value.en.length >= 1, { path: ["en"], message: BODY_REQUIRED_ERROR });

export type KbArticleBody = z.infer<typeof kbArticleBodySchema>;

export const createKbArticleSchema = z.object({
  title: localizedNameSchema,
  body: kbArticleBodySchema,
  topic: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(TOPIC_MAX, TOPIC_ERROR).optional(),
  ),
});

export type CreateKbArticleInput = z.infer<typeof createKbArticleSchema>;

// Pre-transform shape (what the form fields hold before title/body are normalized).
export type CreateKbArticleFormInput = z.input<typeof createKbArticleSchema>;

export const updateKbArticleSchema = createKbArticleSchema;

export type UpdateKbArticleInput = z.infer<typeof updateKbArticleSchema>;

export type UpdateKbArticleFormInput = z.input<typeof updateKbArticleSchema>;
