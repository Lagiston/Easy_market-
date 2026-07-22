import { z } from "zod";

export const INQUIRY_URGENCIES = ["low", "medium", "high"] as const;
export type InquiryUrgency = (typeof INQUIRY_URGENCIES)[number];

// The exact shape GPT-5.6 Luna must return — passed directly as generateObject's
// schema. productId is nullable (no confident product match) and validated
// against real, non-deleted products server-side after generation (the model
// can't be trusted to only emit real ids).
export const inquiryClassificationSchema = z.object({
  topic: z.string().trim().min(1).max(100),
  urgency: z.enum(INQUIRY_URGENCIES),
  confidence: z.number().min(0).max(1),
  productId: z.string().nullable(),
  escalate: z.boolean(),
});

export type InquiryClassification = z.infer<typeof inquiryClassificationSchema>;
