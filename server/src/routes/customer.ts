import { randomUUID } from "node:crypto";
import { Router } from "express";
import { linkGuestOrdersSchema, updateReviewSchema } from "@es-market/core";
import { prisma } from "../lib/prisma";
import { requireCustomerAuth } from "../middleware/require-customer-auth";
import { linkOrdersLimiter } from "../middleware/rate-limit";
import { orderWithItems, serializePublicOrder, normalizePhone } from "./orders";
import { publicReviewSelect, publicProductSelect } from "./storefront";

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
  const { authorName, rating, comment } = parsed.data;
  const updated = await prisma.review.updateMany({
    where: { id: req.params.id, customerId: req.customer.id },
    data: { authorName, rating, comment: comment ?? null },
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
// leak a null join.
customerRouter.get("/customer/wishlist", requireCustomerAuth, async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { customerId: req.customer.id, product: { deletedAt: null } },
    select: { product: { select: publicProductSelect } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ products: items.map((item) => item.product) });
});

// Idempotent add — upsert on the (customerId, productId) unique constraint so
// a double-clicked heart icon (or a retried request) is always safe, same
// spirit as the variant-link route's "already linked" no-op branch.
customerRouter.post<{ productId: string }>(
  "/customer/wishlist/:productId",
  requireCustomerAuth,
  async (req, res) => {
    const { productId } = req.params;
    const product = await prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    await prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId: req.customer.id, productId } },
      create: { id: randomUUID(), customerId: req.customer.id, productId },
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
