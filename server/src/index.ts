import "./instrument";

import * as Sentry from "@sentry/node";
import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { customerAuth } from "./lib/customer-auth";
import { prisma } from "./lib/prisma";
import { uploadsDir } from "./lib/uploads";
import {
  aiLimiter,
  apiLimiter,
  authLimiter,
  inquiryLimiter,
  inquiryPollLimiter,
  orderLimiter,
} from "./middleware/rate-limit";
import { usersRouter } from "./routes/users";
import { productsRouter } from "./routes/products";
import { categoriesRouter } from "./routes/categories";
import { storefrontRouter } from "./routes/storefront";
import { ordersRouter } from "./routes/orders";
import { customerRouter } from "./routes/customer";
import { inquiriesRouter } from "./routes/inquiries";
import { settingsRouter } from "./routes/settings";
import { dashboardRouter } from "./routes/dashboard";
import { kbArticlesRouter } from "./routes/kb-articles";
import { aiRouter } from "./routes/ai";
import { startQueue } from "./lib/queue";
import { registerProductClassificationWorker } from "./lib/product-classification-job";
import { registerProductStockSnapshotWorker } from "./lib/product-stock-snapshot-job";

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

// API-only server (no HTML views), so helmet's default CSP/HSTS/frame/nosniff
// defaults are safe as-is — nothing here renders untrusted markup.
app.use(helmet());

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
  app.use("/api/ai", aiLimiter);
  app.use("/api", apiLimiter);
}

app.all("/api/auth/*splat", toNodeHandler(auth));
app.all("/api/customer-auth/*splat", toNodeHandler(customerAuth));

app.use(express.json());

app.use("/api/uploads", express.static(uploadsDir));

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
app.use("/api", storefrontRouter);
app.use("/api", ordersRouter);
app.use("/api", customerRouter);
app.use("/api", inquiriesRouter);
app.use("/api", settingsRouter);
app.use("/api", dashboardRouter);
app.use("/api", kbArticlesRouter);
app.use("/api", aiRouter);

Sentry.setupExpressErrorHandler(app);

// Note (dev-only): Bun's --hot reload re-runs this module on every save, so
// repeated hot reloads can register duplicate pg-boss workers in the same
// process (now covering both registerProductClassificationWorker and
// registerProductStockSnapshotWorker) — each duplicate re-processes the same
// jobs redundantly. boss.schedule() itself is unaffected (it upserts by
// queue name, so repeated calls don't create duplicate schedules). Not
// solved here — flagged, same as other accepted v1 gaps in this codebase;
// restarting the dev server clears it.
await startQueue();
await registerProductClassificationWorker();
await registerProductStockSnapshotWorker();

app.listen(port, () => {
  console.log(`ES-Market server listening on http://localhost:${port}`);
});
