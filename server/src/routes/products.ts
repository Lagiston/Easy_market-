import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { fileTypeFromBuffer } from "file-type";
import { Role, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { productImagesDir } from "../lib/uploads";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { boss, CLASSIFY_PRODUCT_QUEUE } from "../lib/queue";
import { acquireReclassifyLock } from "../lib/product-reclassify-lock";
import {
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
  reclassifyStatusQuerySchema,
  dismissProductSuggestionSchema,
  PRODUCTS_PAGE_SIZE,
  MAX_PRODUCT_IMAGES,
  type ProductSortField,
} from "@es-market/core";

// Product endpoints; mounted at /api in index.ts.
export const productsRouter = Router();

const productInclude = {
  category: true,
  assignedAgent: { select: { id: true, name: true } },
} as const;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Buffered in memory (not written to disk by multer directly) because the
// declared mimetype/extension can't be trusted until the actual file bytes
// are inspected below — an attacker can label any payload "image/jpeg" in
// the multipart Content-Type field. fileFilter here is just a cheap early
// rejection on the obviously-wrong declared type; the real gate is the
// magic-byte check in writeValidatedProductImages.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_EXTENSIONS[file.mimetype]) {
      // Distinct field name from "images" so the error handler below can
      // tell this apart from multer's own "too many files" rejection, which
      // reuses the real field name ("images") on its LIMIT_UNEXPECTED_FILE.
      cb(new MulterError("LIMIT_UNEXPECTED_FILE", "invalidImageType"));
      return;
    }
    cb(null, true);
  },
});

const INVALID_IMAGE_MESSAGE = "Image must be a JPEG, PNG, or WebP file";

function uploadImages(req: Request, res: Response, next: NextFunction) {
  upload.array("images", MAX_PRODUCT_IMAGES)(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Each image must be 5MB or smaller"
          : err.code === "LIMIT_UNEXPECTED_FILE" && err.field === "images"
            ? `A product can have at most ${MAX_PRODUCT_IMAGES} images`
            : INVALID_IMAGE_MESSAGE;
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

// Detects each file's real type from its magic bytes (never trusting the
// client-declared mimetype/extension) and, only if every file in the batch
// is genuinely an allowed image type, writes them all to disk under
// server-generated filenames + extensions derived from the detected types.
// All-or-nothing: rejects (and writes nothing) if any single file in the
// batch isn't actually an image, rather than silently dropping bad ones.
// Returns null (having already sent the 400 response) on rejection.
async function writeValidatedProductImages(
  files: Express.Multer.File[],
  res: Response,
): Promise<string[] | null> {
  const extensions: string[] = [];
  for (const file of files) {
    const detected = await fileTypeFromBuffer(file.buffer);
    const extension = detected ? IMAGE_EXTENSIONS[detected.mime] : undefined;
    if (!extension) {
      res.status(400).json({ error: INVALID_IMAGE_MESSAGE });
      return null;
    }
    extensions.push(extension);
  }

  return Promise.all(
    files.map(async (file, index) => {
      const filename = `${randomUUID()}${extensions[index]}`;
      await writeFile(path.join(productImagesDir, filename), file.buffer);
      return filename;
    }),
  );
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
  price: (a, b) => a.price - b.price,
  stock: (a, b) => a.stock - b.stock,
  createdAt: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
};

productsRouter.get("/products", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = productListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { sortBy, sortOrder, search, page } = parsed.data;

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });

  // Same reasoning as PRODUCT_SORT_COMPARATORS above: name/category are localized
  // JSON, so matching against the English value is done in JS rather than Postgres.
  const query = search?.toLowerCase();
  const filtered = query
    ? products.filter(
        (product) =>
          localizedEn(product.name).toLowerCase().includes(query) ||
          localizedEn(product.category.name).toLowerCase().includes(query) ||
          // Tags are already stored lowercase (see createProductSchema), so no
          // need to lowercase them again here.
          product.tags.some((tag) => tag.includes(query)),
      )
    : products;

  const direction = sortOrder === "asc" ? 1 : -1;
  const sorted = [...filtered].sort(
    (a, b) => direction * PRODUCT_SORT_COMPARATORS[sortBy](a, b),
  );

  const total = sorted.length;
  if (page === undefined) {
    res.json({ products: sorted, total });
    return;
  }

  const start = (page - 1) * PRODUCTS_PAGE_SIZE;
  const paginated = sorted.slice(start, start + PRODUCTS_PAGE_SIZE);

  res.json({ products: paginated, total, page, pageSize: PRODUCTS_PAGE_SIZE });
});

productsRouter.post("/products", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name, description, price, stock, lowStockThreshold, categoryId, assignedAgentId, tags } =
    parsed.data;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.deletedAt) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  if (assignedAgentId) {
    const agent = await prisma.user.findUnique({ where: { id: assignedAgentId } });
    if (!agent || agent.deletedAt || agent.role !== Role.AGENT) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
  }

  const product = await prisma.product.create({
    data: {
      id: randomUUID(),
      name,
      description: description ?? Prisma.JsonNull,
      price,
      stock,
      lowStockThreshold,
      categoryId,
      assignedAgentId: assignedAgentId ?? null,
      tags,
    },
    include: productInclude,
  });
  res.status(201).json({ product });
});

// These two must be registered before GET /products/:id below — Express
// matches routes in registration order, and "/products/:id" would otherwise
// swallow "/products/reclassify-status" (treating it as an id).
productsRouter.post("/products/reclassify-all", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  // Guard against a second batch starting while one is still in flight —
  // this also keeps reclassify-status's "since" approximation (below) from
  // double-counting, since overlapping batches can no longer happen.
  const acquired = await acquireReclassifyLock();
  if (!acquired) {
    res.status(409).json({ error: "A reclassify batch is already running" });
    return;
  }

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  const since = new Date();
  await Promise.all(
    products.map((product) => boss.send(CLASSIFY_PRODUCT_QUEUE, { productId: product.id })),
  );

  res.json({ total: products.length, since: since.toISOString() });
});

productsRouter.get("/products/reclassify-status", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = reclassifyStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }

  // Approximation: counts any product whose suggestion was (re)computed since
  // the given timestamp, not specifically ones from this exact batch — fine
  // for a single admin triggering one bulk run at a time; two overlapping
  // bulk runs would double-count. Not solved here, same spirit as other
  // flagged v1 simplifications in this codebase.
  const completed = await prisma.product.count({
    where: { deletedAt: null, aiSuggestedAt: { gte: new Date(parsed.data.since) } },
  });

  res.json({ completed });
});

productsRouter.get<{ id: string }>("/products/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: productInclude,
  });
  if (!product || product.deletedAt) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json({ product });
});

productsRouter.put<{ id: string }>("/products/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name, description, price, stock, lowStockThreshold, categoryId, assignedAgentId, tags } =
    parsed.data;
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

  if (assignedAgentId) {
    const agent = await prisma.user.findUnique({ where: { id: assignedAgentId } });
    if (!agent || agent.deletedAt || agent.role !== Role.AGENT) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      name,
      description: description ?? Prisma.JsonNull,
      price,
      stock,
      lowStockThreshold,
      categoryId,
      assignedAgentId: assignedAgentId ?? null,
      tags,
      // Any manual edit supersedes a stale pending bulk-reclassify suggestion.
      aiSuggestedCategoryId: null,
      aiSuggestedTags: [],
      aiSuggestedAt: null,
    },
    include: productInclude,
  });
  res.json({ product });
});

productsRouter.post<{ id: string }>(
  "/products/:id/dismiss-suggestion",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const parsed = dismissProductSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }
    const productId = req.params.id;

    const target = await prisma.product.findUnique({ where: { id: productId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Guarded on aiSuggestedAt still matching what the client last saw, so a
    // suggestion recomputed by a concurrent bulk-reclassify run in between
    // isn't silently discarded by a stale Dismiss click.
    const { count } = await prisma.product.updateMany({
      where: { id: productId, aiSuggestedAt: new Date(parsed.data.aiSuggestedAt) },
      data: { aiSuggestedCategoryId: null, aiSuggestedTags: [], aiSuggestedAt: null },
    });
    if (count === 0) {
      res.status(409).json({ error: "Suggestion changed, please refresh" });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    res.json({ product });
  },
);

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
  "/products/:id/images",
  requireAuth,
  requireRole(Role.ADMIN),
  uploadImages,
  async (req, res) => {
    const productId = req.params.id;

    const target = await prisma.product.findUnique({ where: { id: productId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "At least one image file is required" });
      return;
    }
    if (target.images.length + files.length > MAX_PRODUCT_IMAGES) {
      res.status(400).json({ error: `A product can have at most ${MAX_PRODUCT_IMAGES} images` });
      return;
    }

    const filenames = await writeValidatedProductImages(files, res);
    if (!filenames) return;

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        images: [...target.images, ...filenames.map((f) => `/api/uploads/products/${f}`)],
      },
      include: productInclude,
    });
    res.json({ product });
  },
);

productsRouter.delete<{ id: string; filename: string }>(
  "/products/:id/images/:filename",
  requireAuth,
  requireRole(Role.ADMIN),
  async (req, res) => {
    const productId = req.params.id;

    const target = await prisma.product.findUnique({ where: { id: productId } });
    if (!target || target.deletedAt) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const url = `/api/uploads/products/${req.params.filename}`;
    if (!target.images.includes(url)) {
      res.status(404).json({ error: "Image not found on this product" });
      return;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { images: target.images.filter((image) => image !== url) },
      include: productInclude,
    });
    await unlink(path.join(productImagesDir, req.params.filename)).catch(() => {});
    res.json({ product });
  },
);
