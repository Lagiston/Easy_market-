import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
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
import { inquiriesRouter } from "./routes/inquiries";
import { settingsRouter } from "./routes/settings";
import { dashboardRouter } from "./routes/dashboard";
import { kbArticlesRouter } from "./routes/kb-articles";
import { aiRouter } from "./routes/ai";
import { startQueue } from "./lib/queue";
import { registerProductClassificationWorker } from "./lib/product-classification-job";

const app = express();
const port = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV === "production") {
  app.use("/api/auth", authLimiter);
  app.use("/api/storefront/orders", orderLimiter);
  app.post("/api/storefront/inquiries", inquiryLimiter);
  app.post("/api/storefront/inquiries/:id/messages", inquiryLimiter);
  app.get("/api/storefront/inquiries/:id", inquiryPollLimiter);
  app.use("/api/ai", aiLimiter);
  app.use("/api", apiLimiter);
}

app.all("/api/auth/*splat", toNodeHandler(auth));

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
app.use("/api", inquiriesRouter);
app.use("/api", settingsRouter);
app.use("/api", dashboardRouter);
app.use("/api", kbArticlesRouter);
app.use("/api", aiRouter);

// Note (dev-only): Bun's --hot reload re-runs this module on every save, so
// repeated hot reloads can register duplicate pg-boss workers in the same
// process. Not solved here — flagged, same as other accepted v1 gaps in this
// codebase; restarting the dev server clears it.
await startQueue();
await registerProductClassificationWorker();

app.listen(port, () => {
  console.log(`ES-Market server listening on http://localhost:${port}`);
});
