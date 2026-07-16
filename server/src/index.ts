import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { prisma } from "./lib/prisma";
import { apiLimiter, authLimiter } from "./middleware/rate-limit";
import { requireAuth } from "./middleware/require-auth";
import { usersRouter } from "./routes/users";

const app = express();
const port = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV === "production") {
  app.use("/api/auth", authLimiter);
  app.use("/api", apiLimiter);
}

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.use("/api/users", usersRouter);

app.listen(port, () => {
  console.log(`ES-Market server listening on http://localhost:${port}`);
});
