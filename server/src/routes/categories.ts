import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { uploadImageBuffer, publicIdFromImageUrl, deleteCloudinaryImage } from "../lib/cloudinary";
import { requireAuth, requireRole } from "../middleware/require-auth";
import {
  createImageUpload,
  handleImageUpload,
  isValidImageBuffer,
  INVALID_IMAGE_MESSAGE,
} from "../lib/image-upload";
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
const categoryImageUpload = createImageUpload();
const uploadCategoryImage = handleImageUpload((req, res, cb) =>
  categoryImageUpload.single("image")(req, res, cb),
);

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

    if (!(await isValidImageBuffer(file.buffer))) {
      res.status(400).json({ error: INVALID_IMAGE_MESSAGE });
      return;
    }

    const imageUrl = await uploadImageBuffer(file.buffer, "categories", randomUUID());

    await prisma.category.update({ where: { id: categoryId }, data: { imageUrl } });
    if (target.imageUrl) {
      await deleteCloudinaryImage(publicIdFromImageUrl(target.imageUrl, "categories"));
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
    await deleteCloudinaryImage(publicIdFromImageUrl(target.imageUrl, "categories"));

    res.status(204).end();
  },
);
