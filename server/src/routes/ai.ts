import { Router } from "express";
import { z } from "zod";
import { Role } from "../generated/prisma/client";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { generateStructuredOutput, AiIntegrationError } from "../lib/ai";

// AI endpoints; mounted at /api in index.ts. Grows with 6.4 (classification)
// and 6.6 (reply drafting).
export const aiRouter = Router();

// Verification-only: smoke-tests the OpenAI/Vercel AI SDK wiring (API key,
// model, structured-output parsing). Not exercised by any automated test —
// it makes a real, billable API call.
aiRouter.post("/ai/verify", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  try {
    const result = await generateStructuredOutput(
      z.object({ ok: z.literal(true) }),
      "Respond with ok: true",
    );
    res.json({ result });
  } catch (error) {
    if (error instanceof AiIntegrationError) {
      res.status(502).json({ error: error.message });
      return;
    }
    throw error;
  }
});
