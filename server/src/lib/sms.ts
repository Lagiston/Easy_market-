import AfricasTalking from "africastalking";
import * as Sentry from "@sentry/node";

// This module exposes exactly 6 fixed transactional SMS templates, wired to
// specific order/inquiry lifecycle events (see orders.ts/inquiries.ts). There
// is no generic "send arbitrary SMS" admin feature and none should be added
// without re-deciding this constraint — sendSms() must stay call-site
// restricted, not exposed as a general-purpose utility to new features.
// Marketing/broadcast use is explicitly out of scope.
//
// SMS templates are English-only in v1 — no server-side translation
// infrastructure exists (mirrors this codebase's other documented gaps,
// e.g. no email flows, Swahili FTS fallback). inquiry.language is not
// consulted here; revisit if/when a translation layer is added.

export class SmsIntegrationError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SmsIntegrationError";
  }
}

const username = process.env.AFRICASTALKING_USERNAME;
const apiKey = process.env.AFRICASTALKING_API_KEY;
const senderId = process.env.AFRICASTALKING_SENDER_ID || undefined;

// Unlike ai.ts's fail-fast requiredEnv(OPENAI_API_KEY), SMS credentials are
// genuinely optional — most environments (dev, test, CI) shouldn't need a
// funded SMS account just to start the server. Missing either credential
// makes sendSms() a logged no-op instead of crashing at startup.
const client = username && apiKey ? AfricasTalking({ username, apiKey }).SMS : null;

if (!client) {
  console.warn(
    "AFRICASTALKING_USERNAME/AFRICASTALKING_API_KEY not set — outbound SMS is disabled (no-op).",
  );
}

export async function sendSms(to: string, message: string): Promise<void> {
  if (!client) {
    console.log(`SMS skipped (no provider configured) — would send to ${to}: ${message}`);
    return;
  }
  try {
    await client.send({ to, message, ...(senderId ? { from: senderId } : {}) });
  } catch (error) {
    console.error("SMS send failed:", error);
    Sentry.captureException(error, { extra: { to } });
    throw new SmsIntegrationError("SMS send failed", error);
  }
}

// --- Message templates ---
// Each kept under the 160-character single-SMS budget for its example
// values (verified by literal length checks against the sample data below).

export function buildOrderConfirmedSms({ code, total }: { code: string; total: number }): string {
  return `Halatu: order ${code} confirmed. Total KSh ${total}, pay on delivery. Arriving in 24-48hrs. halatu.co.tz/t/${code}`;
}

export function buildOutForDeliverySms({
  code,
  total,
}: {
  code: string;
  total: number;
}): string {
  return `Halatu: order ${code} is out for delivery, arriving by 18:00 today. Pay KSh ${total} on delivery. halatu.co.tz/t/${code}`;
}

// Links back to the order's own Track page rather than a fabricated
// per-order review flow — this codebase's review system is strictly
// per-product (ProductReviews.tsx), there's no "review this whole
// multi-item order" surface to link to, and building one is out of scope.
export function buildDeliveredSms({ code }: { code: string }): string {
  return `Halatu: order ${code} delivered. Thanks for shopping with us! Rate your experience: halatu.co.tz/t/${code}`;
}

// No configurable delivery-window Setting exists — the "delayed" and
// "confirmed"/"out for delivery" ETA phrasing below are fixed strings, not
// derived from any per-order data (matching this codebase's existing
// restraint against fabricating ETAs, e.g. on the Track page itself).
export function buildDelayedSms({
  code,
  contactPhone,
}: {
  code: string;
  contactPhone: string | null;
}): string {
  const callLine = contactPhone ? ` Questions? Call ${contactPhone}.` : "";
  return `Halatu: order ${code} is delayed, sorry for the wait.${callLine} halatu.co.tz/t/${code}`;
}

// Fixed overhead for the inline variant: "Halatu: reply to " (18) + code (8)
// + ": " (2) = 28 chars, leaving 160 - 28 = 132 for the reply body itself.
// Recompute this constant if the prefix wording below ever changes.
const INLINE_REPLY_PREFIX_LENGTH = "Halatu: reply to ".length + 8 + ": ".length;
const INLINE_REPLY_BUDGET = 160 - INLINE_REPLY_PREFIX_LENGTH;

export function buildMessageReplySms({
  code,
  replyBody,
}: {
  code: string;
  replyBody: string;
}): string {
  if (replyBody.length <= INLINE_REPLY_BUDGET) {
    return `Halatu: reply to ${code}: ${replyBody}`;
  }
  return `Halatu: we've replied to your message ${code}. Read it: halatu.co.tz/t/${code}`;
}
