import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { uploadImageBuffer, deleteCloudinaryImage } from "../lib/cloudinary";

// Verification-only: smoke-tests the Cloudinary credential wiring end to
// end (upload + delete) with a throwaway 1x1 PNG, same purpose as
// /api/ai/verify and /api/sentry/verify. Not exercised by any automated
// test — it makes real Cloudinary API calls.
export const cloudinaryVerifyRouter = Router();

// Smallest possible valid PNG (1x1 transparent pixel).
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

cloudinaryVerifyRouter.post(
  "/cloudinary/verify",
  requireAuth,
  requireRole(Role.ADMIN),
  async (_req, res) => {
    const publicId = `verify/${randomUUID()}`;
    try {
      const url = await uploadImageBuffer(TEST_PNG, "verify", publicId.split("/")[1]);
      await deleteCloudinaryImage(publicId);
      res.json({ result: { ok: true, url } });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Cloudinary verification failed",
      });
    }
  },
);
