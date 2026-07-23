import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, APICallError, NoObjectGeneratedError, RetryError } from "ai";
import type { ZodType } from "zod";
import * as Sentry from "@sentry/node";
import { requiredEnv } from "./env";

// Model id for "GPT-5.6 Luna" — confirm this exact string against OpenAI's
// model catalog; it's a placeholder slug pending confirmation.
export const AI_MODEL = "gpt-5.6-luna";

// Constructed at module load so a missing OPENAI_API_KEY fails at server
// startup (same fail-fast philosophy as auth.ts), not on first AI request.
const openai = createOpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });

export class AiIntegrationError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiIntegrationError";
  }
}

// Generic structured-output wrapper — callers supply their own zod schema and
// prompt. Feature-specific schemas (classification, drafting) belong to the
// consuming feature, not this module.
export async function generateStructuredOutput<T>(
  schema: ZodType<T>,
  prompt: string,
  options?: { maxRetries?: number; timeoutMs?: number },
): Promise<T> {
  try {
    const { object } = await generateObject({
      model: openai(AI_MODEL),
      schema,
      prompt,
      maxRetries: options?.maxRetries ?? 2,
      abortSignal: AbortSignal.timeout(options?.timeoutMs ?? 30_000),
    });
    return object;
  } catch (error) {
    // Full detail logged server-side only; never forward raw SDK/API
    // internals (can include request/response bodies) to an HTTP response.
    console.error("AI structured-output call failed:", error);
    Sentry.captureException(error);

    if (NoObjectGeneratedError.isInstance(error)) {
      throw new AiIntegrationError(
        "AI response could not be parsed into the expected format",
        error,
      );
    }
    // generateObject wraps a retryable failure's final attempt in RetryError
    // (not itself an APICallError) once maxRetries is exhausted — e.g. a
    // sustained 429/5xx. Must be checked before the plain APICallError case.
    if (RetryError.isInstance(error) || APICallError.isInstance(error)) {
      throw new AiIntegrationError("AI service request failed", error);
    }
    throw new AiIntegrationError("AI integration error", error);
  }
}
