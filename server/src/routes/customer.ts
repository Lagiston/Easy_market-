import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer, { MulterError } from "multer";
import { fileTypeFromBuffer } from "file-type";
import { verifyPassword } from "better-auth/crypto";
import { linkGuestOrdersSchema, updateReviewSchema, deleteCustomerAccountSchema } from "@es-market/core";
import { prisma } from "../lib/prisma";
import { uploadImageBuffer, publicIdFromImageUrl, deleteCloudinaryImage } from "../lib/cloudinary";
import { requireCustomerAuth } from "../middleware/require-customer-auth";
import { linkOrdersLimiter } from "../middleware/rate-limit";
import { orderWithItems, serializePublicOrder, normalizePhone } from "./orders";
import { publicReviewSelect, publicProductSelect, attachProductSummaries } from "./storefront";

// Customer-account-only endpoints (signed-in customers, not staff); mounted
// at /api in index.ts. Signup/sign-in/sign-out themselves are handled by the
// customerAuth handler mount (/api/customer-auth/*), not here.
export const customerRouter = Router();

customerRouter.get("/customer/orders", requireCustomerAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { customerId: req.customer.id },
    include: orderWithItems,
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders: orders.map(serializePublicOrder) });
});

// A customer voluntarily claims past guest orders placed with a phone number
// they provide — never automatic/silent. Matches customerPhone the same
// normalized way as the guest lookup route. v1 simplification: matching
// happens in JS over all still-unclaimed orders (fine at this store's
// expected scale, same tradeoff already accepted for the tag-flattening and
// AI-classification-catalog queries elsewhere) rather than a normalized SQL
// comparison. Only ever claims orders with customerId still null — can't
// steal an order that's already linked to a (possibly different) account.
// linkOrdersLimiter is keyed on req.customer.id (not IP), so — unlike every
// other rate limiter in this codebase, all applied globally in index.ts
// before express.json()/any route — it has to be applied here, after
// requireCustomerAuth. Dev/E2E stay unthrottled, same as the rest.
const linkByPhoneMiddleware =
  process.env.NODE_ENV === "production"
    ? [requireCustomerAuth, linkOrdersLimiter]
    : [requireCustomerAuth];

customerRouter.post("/customer/orders/link-by-phone", ...linkByPhoneMiddleware, async (req, res) => {
  const parsed = linkGuestOrdersSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const normalizedInput = normalizePhone(parsed.data.phone);

  const unclaimed = await prisma.order.findMany({
    where: { customerId: null },
    select: { id: true, customerPhone: true },
  });
  const matchingIds = unclaimed
    .filter((order) => normalizePhone(order.customerPhone) === normalizedInput)
    .map((order) => order.id);

  const updated = await prisma.order.updateMany({
    where: { id: { in: matchingIds }, customerId: null },
    data: { customerId: req.customer.id },
  });

  res.json({ linkedCount: updated.count });
});

// Self-service edit/delete of a review the signed-in customer authored
// themselves — the storefront POST route stays guest-first/optional-auth, but
// a customer with an account should be able to fix a typo or remove their own
// review rather than being stuck with the admin-only moderation delete
// (server/src/routes/reviews.ts) as the only way it ever comes down.
// Ownership is enforced by scoping the guarded write to customerId in the
// same query, not a separate existence check — a review that exists but
// belongs to someone else 404s exactly like one that doesn't exist at all,
// same non-enumerable-by-mismatch precedent as the order-lookup route.
customerRouter.put<{ id: string }>("/customer/reviews/:id", requireCustomerAuth, async (req, res) => {
  const parsed = updateReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { authorName, rating, headline, comment } = parsed.data;
  const updated = await prisma.review.updateMany({
    where: { id: req.params.id, customerId: req.customer.id },
    data: { authorName, rating, headline: headline ?? null, comment: comment ?? null },
  });
  if (updated.count === 0) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  const review = await prisma.review.findUniqueOrThrow({
    where: { id: req.params.id },
    select: publicReviewSelect,
  });
  res.json({ review });
});

customerRouter.delete<{ id: string }>(
  "/customer/reviews/:id",
  requireCustomerAuth,
  async (req, res) => {
    const deleted = await prisma.review.deleteMany({
      where: { id: req.params.id, customerId: req.customer.id },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    res.status(204).end();
  },
);

// Signed-in customer's saved-for-later products — account-only (no guest
// tier), newest first. Excludes soft-deleted products: a wishlisted product
// can be deleted later, and it should silently drop off the list rather than
// leak a null join. Each product carries computed `backInStock`/`priceDropped`
// flags (see WishlistItem.wasOutOfStockAtSave/priceAtSave's doc comments) —
// this store has no email/push infrastructure, so this is the entire
// "notification": a visible signal read at request time, not a stored/pushed
// alert. Also runs the products through attachProductSummaries — the same
// review/wishlist-count summary the storefront list/detail routes attach —
// so this endpoint's response is genuinely StorefrontProduct-shaped (it
// wasn't before: averageRating/reviewCount/wishlistCount were previously
// just missing at runtime despite the client type already declaring them).
customerRouter.get("/customer/wishlist", requireCustomerAuth, async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { customerId: req.customer.id, product: { deletedAt: null } },
    select: {
      wasOutOfStockAtSave: true,
      priceAtSave: true,
      product: { select: publicProductSelect },
    },
    orderBy: { createdAt: "desc" },
  });
  // attachProductSummaries preserves input order, so index-correlating back
  // to `items` for the wishlist-specific fields below is safe.
  const productsWithSummaries = await attachProductSummaries(items.map((item) => item.product));
  res.json({
    products: productsWithSummaries.map((product, index) => {
      const item = items[index]!;
      return {
        ...product,
        backInStock: item.wasOutOfStockAtSave && product.stock > 0,
        priceDropped: item.priceAtSave !== null && product.price < item.priceAtSave,
        priceAtSave: item.priceAtSave,
      };
    }),
  });
});

// Idempotent add — upsert on the (customerId, productId) unique constraint so
// a double-clicked heart icon (or a retried request) is always safe, same
// spirit as the variant-link route's "already linked" no-op branch.
// wasOutOfStockAtSave/priceAtSave are only meaningful to set on first save —
// the `update` branch stays a no-op (re-adding an already-wishlisted product
// shouldn't silently reset either snapshot).
customerRouter.post<{ productId: string }>(
  "/customer/wishlist/:productId",
  requireCustomerAuth,
  async (req, res) => {
    const { productId } = req.params;
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true, stock: true, price: true },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    await prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId: req.customer.id, productId } },
      create: {
        id: randomUUID(),
        customerId: req.customer.id,
        productId,
        wasOutOfStockAtSave: product.stock === 0,
        priceAtSave: product.price,
      },
      update: {},
    });
    res.status(204).end();
  },
);

// Ownership enforced in the same where as the delete — a mismatched-owner or
// nonexistent item both 404 identically, same precedent as
// DELETE /customer/reviews/:id above.
customerRouter.delete<{ productId: string }>(
  "/customer/wishlist/:productId",
  requireCustomerAuth,
  async (req, res) => {
    const deleted = await prisma.wishlistItem.deleteMany({
      where: { customerId: req.customer.id, productId: req.params.productId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: "Wishlist item not found" });
      return;
    }
    res.status(204).end();
  },
);

// Profile picture upload — a single-file variant of the product image
// upload pattern in routes/products.ts (same magic-byte validation via
// file-type, never trusting the declared mimetype). Unlike product images
// (an appended gallery), an avatar *replaces* whatever was there before, so
// on success the customer's previous avatar file (if any) is best-effort
// unlinked and Customer.image is overwritten rather than appended to.
const AVATAR_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const INVALID_AVATAR_MESSAGE = "Image must be a JPEG, PNG, or WebP file";

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_IMAGE_EXTENSIONS[file.mimetype]) {
      cb(new MulterError("LIMIT_UNEXPECTED_FILE", "invalidImageType"));
      return;
    }
    cb(null, true);
  },
});

function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  avatarUpload.single("image")(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 5MB or smaller"
          : INVALID_AVATAR_MESSAGE;
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

customerRouter.post(
  "/customer/profile/avatar",
  requireCustomerAuth,
  uploadAvatar,
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "An image file is required" });
      return;
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !AVATAR_IMAGE_EXTENSIONS[detected.mime]) {
      res.status(400).json({ error: INVALID_AVATAR_MESSAGE });
      return;
    }

    const current = await prisma.customer.findUniqueOrThrow({
      where: { id: req.customer.id },
      select: { image: true },
    });

    const image = await uploadImageBuffer(file.buffer, "customers", randomUUID());

    await prisma.customer.update({ where: { id: req.customer.id }, data: { image } });
    if (current.image) {
      await deleteCloudinaryImage(publicIdFromImageUrl(current.image, "customers"));
    }

    res.json({ image });
  },
);

customerRouter.delete("/customer/profile/avatar", requireCustomerAuth, async (req, res) => {
  const current = await prisma.customer.findUniqueOrThrow({
    where: { id: req.customer.id },
    select: { image: true },
  });
  if (!current.image) {
    res.status(404).json({ error: "No profile picture to remove" });
    return;
  }

  await prisma.customer.update({ where: { id: req.customer.id }, data: { image: null } });
  await deleteCloudinaryImage(publicIdFromImageUrl(current.image, "customers"));

  res.status(204).end();
});

// Self-service account deletion — no Better Auth deleteUser plugin is
// configured, so this is hand-written. Requires re-entering the current
// password (verified via Better Auth's own verifyPassword primitive, not a
// hand-rolled hash check) as a guard against a hijacked/left-open session.
// Customer has no deletedAt (soft-delete was deliberately never built for
// it) — this is a genuine hard delete. Orders/reviews are point-in-time
// snapshots (customerName/authorName/etc. already carry what they need
// independent of the Customer row), so they're anonymized (customerId
// nulled, same shape as a guest order/review) rather than deleted or
// blocking deletion. CustomerSession/CustomerAccount/WishlistItem all
// cascade automatically via onDelete: Cascade on their customerId FK.
customerRouter.delete("/customer/account", requireCustomerAuth, async (req, res) => {
  const parsed = deleteCustomerAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }

  const credentialAccount = await prisma.customerAccount.findFirst({
    where: { customerId: req.customer.id, providerId: "credential" },
    select: { password: true },
  });
  if (
    !credentialAccount?.password ||
    !(await verifyPassword({ hash: credentialAccount.password, password: parsed.data.password }))
  ) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  await prisma.$transaction([
    prisma.order.updateMany({ where: { customerId: req.customer.id }, data: { customerId: null } }),
    prisma.review.updateMany({ where: { customerId: req.customer.id }, data: { customerId: null } }),
    prisma.customer.delete({ where: { id: req.customer.id } }),
  ]);

  res.status(204).end();
});
