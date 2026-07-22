import { z } from "zod";

export const INQUIRY_URGENCIES = ["low", "medium", "high"] as const;
export type InquiryUrgency = (typeof INQUIRY_URGENCIES)[number];

// The exact shape GPT-5.6 Luna must return — passed directly as generateObject's
// schema. productId is nullable (no confident product match) and validated
// against real, non-deleted products server-side after generation (the model
// can't be trusted to only emit real ids). canAutoResolve/autoResolveReply
// fold the knowledge-base.md auto-resolve judgment into this same call
// (rather than a second AI round-trip) — autoResolveReply is nullable, not
// optional, for the same strict-structured-output reason as productId, and
// is only meaningful when canAutoResolve is true.
export const inquiryClassificationSchema = z.object({
  topic: z.string().trim().min(1).max(100),
  urgency: z.enum(INQUIRY_URGENCIES),
  confidence: z.number().min(0).max(1),
  productId: z.string().nullable(),
  escalate: z.boolean(),
  canAutoResolve: z.boolean(),
  autoResolveReply: z.string().trim().min(1).max(5000).nullable(),
});

export type InquiryClassification = z.infer<typeof inquiryClassificationSchema>;
