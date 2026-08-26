import "./instrument";

import path from "node:path";
import * as Sentry from "@sentry/node";
import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { customerAuth } from "./lib/customer-auth";
import { prisma } from "./lib/prisma";
import {
  aiLimiter,
  apiLimiter,
  authLimiter,
  inquiryLimiter,
  inquiryPollLimiter,
  orderLimiter,
  reviewLimiter,
} from "./middleware/rate-limit";
import { usersRouter } from "./routes/users";
import { productsRouter } from "./routes/products";
import { categoriesRouter } from "./routes/categories";
import { tagsRouter } from "./routes/tags";
import { storefrontRouter } from "./routes/storefront";
import { ordersRouter } from "./routes/orders";
import { customerRouter } from "./routes/customer";
import { inquiriesRouter } from "./routes/inquiries";
import { settingsRouter } from "./routes/settings";
import { siteContentRouter } from "./routes/site-content";
import { dashboardRouter } from "./routes/dashboard";
import { kbArticlesRouter } from "./routes/kb-articles";
import { promoBlocksRouter } from "./routes/promo-blocks";
import { reviewsRouter } from "./routes/reviews";
import { aiRouter } from "./routes/ai";
import { sentryRouter } from "./routes/sentry";
import { cloudinaryVerifyRouter } from "./routes/cloudinary-verify";
import { startQueue } from "./lib/queue";
import { registerProductClassificationWorker } from "./lib/product-classification-job";
import { registerProductStockSnapshotWorker } from "./lib/product-stock-snapshot-job";
import { registerSmsLogRetentionWorker } from "./lib/sms-log-retention-job";

const app = express();
const port = Number(process.env.PORT ?? 3000);

// Explicit opt-in only — an unconfigured VPS deployment sits directly on the
// internet with no reverse proxy in front, and blindly trusting
// X-Forwarded-For in that case would let any client spoof the IP
// express-rate-limit keys its buckets on, bypassing every per-IP limiter
// below. Only set TRUST_PROXY_HOPS once a real reverse proxy/load balancer
// (nginx, Caddy, a platform LB, ...) is actually in front of this process —
// the value is the number of proxy hops to trust (usually 1).
if (process.env.TRUST_PROXY_HOPS) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
}

// This process also serves the built client in production (see the static
// block below), so helmet's default CSP (script-src/img-src/media-src
// 'self' only) needs explicit exceptions: img-src/media-src for
// Cloudinary-hosted product/category/avatar images and the homepage video
// (res.cloudinary.com). No script-src exception is needed — the dark-mode
// pre-paint script lives in client/public/theme-init.js and is served
// same-origin, so it's already covered by the 'self' default.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
        "media-src": ["'self'", "https://res.cloudinary.com"],
      },
    },
  }),
);

// POST /customer/orders/link-by-phone is rate-limited too, but per signed-in
// customer rather than per IP — see linkOrdersLimiter's own comment. That
// needs req.customer, so it's applied directly in customer.ts's route
// registration (after requireCustomerAuth) instead of here.
if (process.env.NODE_ENV === "production") {
  app.use("/api/auth", authLimiter);
  app.use("/api/customer-auth", authLimiter);
  app.use("/api/storefront/orders", orderLimiter);
  app.post("/api/storefront/inquiries", inquiryLimiter);
  app.post("/api/storefront/inquiries/:id/messages", inquiryLimiter);
  app.get("/api/storefront/inquiries/:id", inquiryPollLimiter);
  app.post("/api/storefront/products/:id/reviews", reviewLimiter);
  app.use("/api/ai", aiLimiter);
  app.use("/api", apiLimiter);
}

app.all("/api/auth/*splat", toNodeHandler(auth));
app.all("/api/customer-auth/*splat", toNodeHandler(customerAuth));

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.use("/api", usersRouter);
app.use("/api", productsRouter);
app.use("/api", categoriesRouter);
app.use("/api", tagsRouter);
app.use("/api", storefrontRouter);
app.use("/api", ordersRouter);
app.use("/api", customerRouter);
app.use("/api", inquiriesRouter);
app.use("/api", settingsRouter);
app.use("/api", siteContentRouter);
app.use("/api", dashboardRouter);
app.use("/api", kbArticlesRouter);
app.use("/api", promoBlocksRouter);
app.use("/api", reviewsRouter);
app.use("/api", aiRouter);
app.use("/api", sentryRouter);
app.use("/api", cloudinaryVerifyRouter);

Sentry.setupExpressErrorHandler(app);

// Serve the built client SPA from this same process/domain in production —
// dev serves the client via Vite's own dev server (bun run dev:client), so
// this block is a no-op there and client/dist need not exist locally.
// Resolved via import.meta.dir (not process.cwd()) so it works regardless of
// the directory Railway's start command runs from — same convention as
// knowledge-base.ts.
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(import.meta.dir, "..", "..", "client", "dist");
  app.use(express.static(clientDist));
  // Any non-API GET that didn't match a static file falls through to
  // index.html so client-side (react-router) routes resolve on hard
  // refresh/deep link. A RegExp (not a "*" string) is used since Express 5's
  // stricter path-to-regexp rejects a bare wildcard string route.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Note (dev-only): Bun's --hot reload re-runs this module on every save, so
// repeated hot reloads can register duplicate pg-boss workers in the same
// process (now covering both registerProductClassificationWorker and
// registerProductStockSnapshotWorker) — each duplicate re-processes the same
// jobs redundantly. boss.schedule() itself is unaffected (it upserts by
// queue name, so repeated calls don't create duplicate schedules). Not
// solved here — flagged, same as other accepted v1 gaps in this codebase;
// restarting the dev server clears it.
console.log("Starting job queue...");
await startQueue();
console.log("Job queue started, registering workers...");
await registerProductClassificationWorker();
await registerProductStockSnapshotWorker();
await registerSmsLogRetentionWorker();
console.log("Workers registered, starting HTTP listener...");

app.listen(port, () => {
  console.log(`Halatu server listening on http://localhost:${port}`);
});
