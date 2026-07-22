import { z } from "zod";

// Structured output for draft generation: the reply text plus which KB
// articles (if any) informed it — needed now so 6.7 can show "sources" later
// without re-deriving them.
export const inquiryDraftSchema = z.object({
  reply: z.string().trim().min(1).max(5000),
  sourceArticleIds: z.array(z.string()),
});

export type InquiryDraft = z.infer<typeof inquiryDraftSchema>;
