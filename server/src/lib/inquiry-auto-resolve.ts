import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { MessageSender, DraftStatus, InquiryStatus } from "../generated/prisma/client";

// Applies an auto-resolve decision already made by classifyInquiry's single
// classification call (see inquiry-classification.ts, which folds the
// knowledge-base.md judgment into the same AI call rather than a second
// round-trip) — no AI call happens here, just the DB write. A deliberate,
// scoped exception to this app's normal "every AI reply requires agent
// approval" policy. Race-safe: only succeeds if the inquiry is still open and
// wasn't escalated out from under it (classifyInquiry only calls this when
// !shouldEscalate, but nothing prevents a concurrent staff action). Returns
// false if the race guard lost — caller should fall back to the normal
// draftInquiryReply review flow instead.
export async function applyAutoResolve(inquiryId: string, reply: string): Promise<boolean> {
  const updated = await prisma.inquiry.updateMany({
    where: { id: inquiryId, status: InquiryStatus.OPEN, escalatedAt: null },
    data: { status: InquiryStatus.RESOLVED, autoResolvedAt: new Date() },
  });
  if (updated.count === 0) {
    return false;
  }

  await prisma.message.create({
    data: {
      id: randomUUID(),
      inquiryId,
      sender: MessageSender.AI_DRAFT,
      body: reply,
      // Not sourced from the KbArticle table — this reply came from the
      // static knowledge-base.md doc instead.
      sourceKbArticleIds: [],
      draftStatus: DraftStatus.AUTO_RESOLVED,
    },
  });
  return true;
}
