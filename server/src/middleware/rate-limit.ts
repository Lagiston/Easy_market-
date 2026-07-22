import { rateLimit } from "express-rate-limit";

// Applied in production only (see src/index.ts) — dev and E2E runs stay unthrottled.

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Stricter limit on public order placement to slow spam orders.
export const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Stricter limit on auth endpoints to slow credential brute-forcing.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Stricter limit on claiming guest orders by phone — each request is a
// phone-number guess that, if it hits, permanently transfers a stranger's
// order (name/address/items) to the requester's account. Keyed on the
// signed-in customer's id, not IP: unlike every other limiter here, IP alone
// isn't a strong enough key for an *authenticated* enumeration attack — one
// account could rotate IPs (VPN/proxy) and keep guessing past a per-IP cap
// while staying logged in. This means the middleware must run after
// requireCustomerAuth has populated req.customer (see its route registration
// in customer.ts), unlike every other limiter here, which are all mounted
// globally in index.ts before any route runs.
export const linkOrdersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.customer.id,
});

// Stricter limit on public inquiry creation/reply to slow contact-form spam.
export const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Looser limit for the chat widget's message-polling GET — steady polling from
// one IP needs far more headroom than the write endpoints above.
export const inquiryPollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Stricter limit on /api/ai routes — unlike most other endpoints, every
// request here is a real, billable OpenAI call, so a much lower ceiling than
// the general apiLimiter caps exposure to a compromised/careless admin
// session (all AI routes are ADMIN-only, so this shouldn't bind legitimate
// staff usage in practice).
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
