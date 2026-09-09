import multer, { MulterError } from "multer";
import type { NextFunction, Request, Response } from "express";
import { fileTypeFromBuffer } from "file-type";

// Shared by every multipart image-upload route (products, categories,
// customer avatar) — the declared mimetype/filename extension is never
// trusted as the real gate (a multipart Content-Type field is
// attacker-controlled); this map is only used for multer's cheap early
// fileFilter rejection and, again, for the real magic-byte check each route
// runs via validateImageBuffer once the file is actually buffered.
export const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const INVALID_IMAGE_MESSAGE = "Image must be a JPEG, PNG, or WebP file";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// `multer.memoryStorage()` buffers the upload instead of streaming it
// straight to disk/Cloudinary, so validateImageBuffer can inspect the real
// bytes before anything is trusted or persisted.
export function createImageUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!IMAGE_MIME_EXTENSIONS[file.mimetype]) {
        cb(new MulterError("LIMIT_UNEXPECTED_FILE", "invalidImageType"));
        return;
      }
      cb(null, true);
    },
  });
}

// Wraps a configured multer handler (`.single(field)` or `.array(field, max)`)
// with the MulterError -> `400 { error }` translation every upload route
// needs, matching the shape other routes' zod-validation failures already
// use. `describeError` lets a caller add its own message for a specific
// MulterError code (e.g. products.ts's "too many images" case) while still
// sharing the LIMIT_FILE_SIZE/fallback wording otherwise.
export function handleImageUpload(
  run: (req: Request, res: Response, cb: (err: unknown) => void) => void,
  describeError: (err: MulterError) => string = (err) =>
    err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller" : INVALID_IMAGE_MESSAGE,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    run(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        res.status(400).json({ error: describeError(err) });
        return;
      }
      if (err) {
        next(err);
        return;
      }
      next();
    });
  };
}

// The actual security gate: detects the file's real type from its magic
// bytes rather than trusting the client-declared mimetype/extension.
export async function isValidImageBuffer(buffer: Buffer): Promise<boolean> {
  const detected = await fileTypeFromBuffer(buffer);
  return !!detected && !!IMAGE_MIME_EXTENSIONS[detected.mime];
}
