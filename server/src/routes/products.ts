import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { Role, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { productImagesDir } from "../lib/uploads";
import { requireAuth, requireRole } from "../middleware/require-auth";
import {
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
  type ProductSortField,
} from "@es-market/core";

// Product endpoints; mounted at /api in index.ts.
export const productsRouter = Router();

const productInclude = {
  category: true,
} as const;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: productImagesDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${IMAGE_EXTENSIONS[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_EXTENSIONS[file.mimetype]) {
      cb(new MulterError("LIMIT_UNEXPECTED_FILE", "image"));
      return;
    }
    cb(null, true);
  },
});

function uploadImage(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 5MB or smaller"
          : "Image must be a JPEG, PNG, or WebP file";
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

// `name` (and `category.name`) are stored as localized JSON, which Postgres/Prisma
// can't order by directly — sorting on those fields is done in JS below instead.
function localizedEn(value: Prisma.JsonValue): string {
  return typeof value === "object" && value !== null && "en" in value
    ? String((value as { en: unknown }).en)
    : "";
}

const PRODUCT_SORT_COMPARATORS: Record<
  ProductSortField,
  (a: Prisma.ProductGetPayload<{ include: typeof productInclude }>, b: (typeof a)) => number
> = {
  name: (a, b) => localizedEn(a.name).localeCompare(localizedEn(b.name)),
  category: (a, b) => localizedEn(a.category.name).localeCompare(localizedEn(b.category.name)),
  stock: (a, b) => a.stock - b.stock,
  createdAt: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
};

productsRouter.get("/products", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = productListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { sortBy, sortOrder } = parsed.data;

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });

  const direction = sortOrder === "asc" ? 1 : -1;
  const sorted = [...products].sort(
    (a, b) => direction * PRODUCT_SORT_COMPARATORS[sortBy](a, b),
  );

  res.json({ products: sorted });
});

productsRouter.post("/products", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name, description, stock, lowStockThreshold, categoryId } = parsed.data;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.deletedAt) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const product = await prisma.product.create({
    data: {
      id: randomUUID(),
      name,
      description: description ?? Prisma.JsonNull,
      stock,
      lowStockThreshold,
      categoryId,
    },
    include: productInclude,
  });
  res.status(201).json({ product });
});

productsRouter.put<{ id: string }>("/products/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name, description, stock, lowStockThreshold, categoryId } = parsed.data;
  const productId = req.params.id;

  const target = await prisma.product.findUnique({ where: { id: productId } });
  if (!target || target.deletedAt) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.deletedAt) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      name,
      description: description ?? Prisma.JsonNull,
      stock,
      lowStockThreshold,
      categoryId,
    },
    include: productInclude,
  });
  res.json({ product });
});

productsRouter.delete<{ id: string }>("/products/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const productId = req.params.id;

  const target = await prisma.product.findUnique({ where: { id: productId } });
  if (!target || target.deletedAt) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await prisma.product.update({ where: { id: productId }, data: { deletedAt: new Date() } });

  res.status(204).end();
});

productsRouter.post<{ id: string }>(
  "/products/:id/image",
  requireAuth,
  requireRole(Role.ADMIN),
  uploadImage,
  async (req, res) => {
    const productId = req.params.id;

    const target = await prisma.product.findUnique({ where: { id: productId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "An image file is required" });
      return;
    }

    if (target.imageUrl) {
      await unlink(path.join(productImagesDir, path.basename(target.imageUrl))).catch(() => {});
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { imageUrl: `/api/uploads/products/${req.file.filename}` },
      include: productInclude,
    });
    res.json({ product });
  },
);
