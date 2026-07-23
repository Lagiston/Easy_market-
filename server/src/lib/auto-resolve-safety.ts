// Deterministic backstop for the AI auto-resolve path (see
// inquiry-auto-resolve.ts): applyAutoResolve sends autoResolveReply straight
// to the customer with no staff review, a deliberate, scoped exception to
// this app's normal "every AI reply requires agent approval" policy. That
// reply is generated from a single classification call whose prompt
// includes the customer's own free-text message — a customer can write
// anything in that field, including a prompt-injection attempt aimed at
// making the model emit a false refund confirmation, a phishing link, or
// fake payment/account instructions in autoResolveReply.
//
// The knowledge base (server/knowledge-base.md) that legitimate auto-resolve
// replies are supposed to be grounded in contains no links, currency
// amounts, or banking details anywhere — so a reply containing any of those
// is already suspicious on its face, whether or not it was reached via
// injection. Rather than trying to detect "is this prompt injection"
// directly (unreliable), this checks the *output* for the categories of
// content that would actually cause real-world harm if sent unreviewed and
// wrong, and blocks auto-send for those regardless of how they got there —
// falling back to the normal staff-reviewed draft flow instead.
const UNSAFE_PATTERNS: RegExp[] = [
  // Links — a legitimate KB-grounded answer never needs to include one; this
  // is the single most damaging thing an injected reply could send (phishing).
  /https?:\/\/|www\.\S+/i,
  // Currency amounts/symbols — the KB states refund *policy* (timeframes,
  // conditions) but never a specific dollar figure, so any concrete amount
  // in a reply is a fabricated commitment, not a real policy statement.
  /[$€£¥]\s?\d|\d\s?(usd|eur|gbp|kes|tzs)\b/i,
  // Banking/payment instructions — never appropriate content for this store
  // (self-delivery, pay on delivery/pickup — see CLAUDE.md's Checkout
  // conventions) let alone something the auto-resolve path should ever send.
  /\b(bank transfer|account number|routing number|iban|swift code|wire transfer|western union|credit card number)\b/i,
  // Discount/coupon grants — auto-resolve has no authority to create these.
  /\b(coupon|promo code|discount code|voucher code)\b/i,
];

export function isAutoResolveReplySafe(reply: string): boolean {
  return !UNSAFE_PATTERNS.some((pattern) => pattern.test(reply));
}
