import { Router } from "express";
import { linkGuestOrdersSchema } from "@es-market/core";
import { prisma } from "../lib/prisma";
import { requireCustomerAuth } from "../middleware/require-customer-auth";
import { linkOrdersLimiter } from "../middleware/rate-limit";
import { orderWithItems, serializePublicOrder, normalizePhone } from "./orders";

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
