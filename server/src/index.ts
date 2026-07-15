import express from "express";
import { prisma } from "./lib/prisma";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.listen(port, () => {
  console.log(`ES-Market server listening on http://localhost:${port}`);
});
