import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

// Prod-only, DSN-optional: mirrors the NODE_ENV=production gating already
// used for rate limiting/secure cookies elsewhere in this codebase. Bun's
// --hot reload re-executes this module on every save in dev, but since the
// guard never passes outside production, that's a no-op rather than a
// duplicate-init concern (unlike the pg-boss worker registration in index.ts).
if (process.env.NODE_ENV === "production" && dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
  });
}
