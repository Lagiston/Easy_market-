import { Router } from "express";
import { z } from "zod";
import { Role } from "../generated/prisma/client";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { generateStructuredOutput, AiIntegrationError } from "../lib/ai";
import { classifyProduct } from "../lib/product-classification";
import {
  recordSuggestion,
  recordAcceptance,
} from "../lib/product-classification-metrics";
import {
  productClassificationRequestSchema,
  productClassificationAcceptSchema,
} from "@es-market/core";

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

// 7.1: suggests a category (from the real catalog) + tags for a product from
// its name/description, for the create/edit form (7.2) to pre-fill. Request/
// response flow — unlike inquiry classification, failures propagate to the
// caller as a 502 rather than being swallowed.
aiRouter.post(
  "/ai/classify-product",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = productClassificationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    try {
      const result = await classifyProduct(parsed.data.name, parsed.data.description);
      await recordSuggestion(result.categoryId !== null, result.tags.length);
      res.json(result);
    } catch (error) {
      if (error instanceof AiIntegrationError) {
        res.status(502).json({ error: error.message });
        return;
      }
      throw error;
    }
  },
);

// Records that a suggested category or tag was actually applied in the form —
// paired with recordSuggestion above to power the dashboard's product
// classification acceptance-rate stat. Fire-and-forget from the client;
// nothing here can fail in a way the UI needs to react to.
aiRouter.post(
  "/ai/classify-product/accept",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = productClassificationAcceptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    await recordAcceptance(parsed.data.field);
    res.status(204).end();
  },
);
