import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { requireAuth, requireRole } from "../middleware/require-auth";

// Verification-only: surfaces the raw forwarded-IP headers Railway's edge
// proxy actually sends, plus Express's own resolved req.ip/req.ips (already
// correctly trusting 1 hop per TRUST_PROXY_HOPS). Better Auth's internal
// rate limiter does its own separate IP resolution from these same headers
// (see advanced.ipAddress in auth.ts/customer-auth.ts) and only trusts a
// single-value x-forwarded-for by default — this route exists to observe
// the real header shape before configuring that trust boundary, rather than
// guessing. Not exercised by any automated test, same as ai/verify,
// sentry/verify, and cloudinary/verify.
export const networkVerifyRouter = Router();

networkVerifyRouter.get(
  "/network/verify",
  requireAuth,
  requireRole(Role.ADMIN),
  (req, res) => {
    res.json({
      xForwardedFor: req.headers["x-forwarded-for"] ?? null,
      xRealIp: req.headers["x-real-ip"] ?? null,
      resolvedIp: req.ip,
      resolvedIps: req.ips,
    });
  },
);
