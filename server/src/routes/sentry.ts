import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { requireAuth, requireRole } from "../middleware/require-auth";

// Verification-only: smoke-tests that Sentry is actually configured and
// forwarding events (SENTRY_DSN valid, network path to Sentry's ingest
// working). Throws deliberately so it's captured by
// Sentry.setupExpressErrorHandler in index.ts, same as any real unhandled
// route error would be. Not exercised by any automated test.
export const sentryRouter = Router();

sentryRouter.post(
  "/sentry/verify",
  requireAuth,
  requireRole(Role.ADMIN),
  (req, _res) => {
    throw new Error(
      `Sentry verification test error, triggered by ${req.user.email} at ${new Date().toISOString()}`,
    );
  },
);
