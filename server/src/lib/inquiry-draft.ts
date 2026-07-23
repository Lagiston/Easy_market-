import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";
import { prisma } from "./prisma";
import { searchKbArticles } from "./kb-search";
import { generateStructuredOutput, AiIntegrationError } from "./ai";
import { MessageSender, DraftStatus } from "../generated/prisma/client";
import { inquiryDraftSchema, type Language } from "@es-market/core";

export async function draftInquiryReply(
  inquiryId: string,
  message: string,
  language: Language,
): Promise<void> {
  try {
    const candidates = await searchKbArticles(message, language);
    const context = candidates
      .map((c) => {
        const titleMap = c.title as Record<string, string>;
        const bodyMap = c.body as Record<string, string>;
        const title = titleMap[language] ?? titleMap.en;
        const body = bodyMap[language] ?? bodyMap.en;
        return `[${c.id}] ${title}\n${body}`;
      })
      .join("\n\n");

    const result = await generateStructuredOutput(
      inquiryDraftSchema,
      `Draft a helpful customer support reply in the "${language}" language for ` +
        `this inquiry, using the knowledge base articles below where relevant. ` +
        `List the ids of any articles you actually used.\n\n` +
        `Knowledge base:\n${context || "(no relevant articles found)"}\n\n` +
        `Inquiry:\n${message}`,
    );

    // Only keep ids that were actually retrieved — same don't-trust-the-model
    // principle as classification's productId matching.
    const validIds = new Set(candidates.map((c) => c.id));
    const sourceKbArticleIds = result.sourceArticleIds.filter((id) => validIds.has(id));

    await prisma.message.create({
      data: {
        id: randomUUID(),
        inquiryId,
        sender: MessageSender.AI_DRAFT,
        body: result.reply,
        sourceKbArticleIds,
        draftStatus: DraftStatus.PENDING,
      },
    });
  } catch (error) {
    // Fire-and-forget: a failed draft must never surface to the customer or
    // block anything — staff just reply manually, as they always could.
    if (error instanceof AiIntegrationError) {
      console.error("Inquiry draft generation failed:", inquiryId, error.message);
      Sentry.captureException(error, { extra: { inquiryId } });
      return;
    }
    console.error("Inquiry draft generation failed unexpectedly:", inquiryId, error);
    Sentry.captureException(error, { extra: { inquiryId } });
  }
}
