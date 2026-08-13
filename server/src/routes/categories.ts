import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { fileTypeFromBuffer } from "file-type";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { categoryImagesDir } from "../lib/uploads";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createCategorySchema, updateCategorySchema, type LocalizedName } from "@es-market/core";

// Category endpoints; mounted at /api in index.ts.
export const categoriesRouter = Router();

async function findByEnglishName(en: string, excludeId?: string) {
  return prisma.category.findFirst({
    where: {
      deletedAt: null,
      name: { path: ["en"], equals: en },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

categoriesRouter.get("/categories", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const categories = await prisma.category.findMany({ where: { deletedAt: null } });
  categories.sort((a, b) => (a.name as LocalizedName).en.localeCompare((b.name as LocalizedName).en));
  res.json({ categories });
});

categoriesRouter.post("/categories", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name, homeRow } = parsed.data;

  const existing = await findByEnglishName(name.en);
  if (existing) {
    res.status(409).json({ error: "A category with this English name already exists" });
    return;
  }

  const category = await prisma.category.create({
    data: { id: randomUUID(), name, homeRow: homeRow ?? null },
  });
  res.status(201).json({ category });
});

categoriesRouter.put<{ id: string }>(
  "/categories/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const { name, homeRow } = parsed.data;
    const categoryId = req.params.id;

    const target = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const existing = await findByEnglishName(name.en, categoryId);
    if (existing) {
      res.status(409).json({ error: "A category with this English name already exists" });
      return;
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: { name, homeRow: homeRow ?? null },
    });
    res.json({ category });
  },
);

categoriesRouter.delete<{ id: string }>(
  "/categories/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const categoryId = req.params.id;

    const target = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    await prisma.category.update({ where: { id: categoryId }, data: { deletedAt: new Date() } });

    res.status(204).end();
  },
);

// Cover image — a single-file variant of the customer avatar upload pattern
// (routes/customer.ts): magic-byte validation via file-type, never trusting
// the declared mimetype, and a replace-not-append write (one cover image,
// not a gallery).
const CATEGORY_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const INVALID_CATEGORY_IMAGE_MESSAGE = "Image must be a JPEG, PNG, or WebP file";

const categoryImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!CATEGORY_IMAGE_EXTENSIONS[file.mimetype]) {
      cb(new MulterError("LIMIT_UNEXPECTED_FILE", "invalidImageType"));
      return;
    }
    cb(null, true);
  },
});

function uploadCategoryImage(req: Request, res: Response, next: NextFunction) {
  categoryImageUpload.single("image")(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller" : INVALID_CATEGORY_IMAGE_MESSAGE;
      res.status(400).json({ error: message });
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

// filename portion of a "/api/uploads/categories/<file>" URL, used to unlink
// a category's previous image file on replace/remove.
function categoryImageFilenameFromUrl(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}

categoriesRouter.post<{ id: string }>(
  "/categories/:id/image",
  requireAuth,
  requireRole(Role.ADMIN),
  uploadCategoryImage,
  async (req, res) => {
    const categoryId = req.params.id;
    const target = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "An image file is required" });
      return;
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    const extension = detected ? CATEGORY_IMAGE_EXTENSIONS[detected.mime] : undefined;
    if (!extension) {
      res.status(400).json({ error: INVALID_CATEGORY_IMAGE_MESSAGE });
      return;
    }

    const filename = `${randomUUID()}${extension}`;
    await writeFile(path.join(categoryImagesDir, filename), file.buffer);
    const imageUrl = `/api/uploads/categories/${filename}`;

    await prisma.category.update({ where: { id: categoryId }, data: { imageUrl } });
    if (target.imageUrl) {
      await unlink(
        path.join(categoryImagesDir, categoryImageFilenameFromUrl(target.imageUrl)),
      ).catch(() => {});
    }

    res.json({ imageUrl });
  },
);

categoriesRouter.delete<{ id: string }>(
  "/categories/:id/image",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const categoryId = req.params.id;
    const target = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    if (!target.imageUrl) {
      res.status(404).json({ error: "No image to remove" });
      return;
    }

    await prisma.category.update({ where: { id: categoryId }, data: { imageUrl: null } });
    await unlink(
      path.join(categoryImagesDir, categoryImageFilenameFromUrl(target.imageUrl)),
    ).catch(() => {});

    res.status(204).end();
  },
);
