import { randomUUID } from "node:crypto";
import AfricasTalking from "africastalking";
import * as Sentry from "@sentry/node";
import { prisma } from "./prisma";
import { SmsLogStatus } from "../generated/prisma/client";

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

// Africa's Talking validates `to` via libphonenumber and expects a real
// international-format number — customerPhone is only loosely validated at
// checkout/contact-form time (e.g. a customer typing "0712345678" with no
// country code passes createOrderSchema/createInquirySchema's regex just
// fine), so this normalizes Tanzania-style local numbers to +255 E.164
// before every send. Falls back to the input unchanged for anything that
// doesn't match a recognizable shape, letting Africa's Talking's own
// validation be the final word rather than silently mangling an
// already-valid number from another country.
export function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("255") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+255${digits.slice(1)}`;
  if (digits.length === 9) return `+255${digits}`;
  return phone;
}

// Logs every send attempt regardless of outcome (including the no-op/SKIPPED
// path) — gives staff visibility into whether a customer was actually
// notified, since every call site below fires this and moves on without
// waiting to find out. A logging failure must never mask the real
// send outcome, so this is always called from a try/catch that swallows.
async function logSms(entry: {
  to: string;
  message: string;
  status: SmsLogStatus;
  error: string | null;
  orderId?: string;
  inquiryId?: string;
}) {
  try {
    await prisma.smsLog.create({
      data: {
        id: randomUUID(),
        to: entry.to,
        message: entry.message,
        status: entry.status,
        error: entry.error,
        orderId: entry.orderId ?? null,
        inquiryId: entry.inquiryId ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write SmsLog row:", error);
    Sentry.captureException(error);
  }
}

export async function sendSms(
  to: string,
  message: string,
  context?: { orderId?: string; inquiryId?: string },
): Promise<void> {
  const normalizedTo = toE164(to);

  if (!client) {
    console.log(`SMS skipped (no provider configured) — would send to ${normalizedTo}: ${message}`);
    await logSms({ to: normalizedTo, message, status: SmsLogStatus.SKIPPED, error: null, ...context });
    return;
  }
  try {
    await client.send({ to: normalizedTo, message, ...(senderId ? { from: senderId } : {}) });
    await logSms({ to: normalizedTo, message, status: SmsLogStatus.SENT, error: null, ...context });
  } catch (error) {
    console.error("SMS send failed:", error);
    Sentry.captureException(error, { extra: { to: normalizedTo } });
    await logSms({
      to: normalizedTo,
      message,
      status: SmsLogStatus.FAILED,
      error: error instanceof Error ? error.message : String(error),
      ...context,
    });
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
