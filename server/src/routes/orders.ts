import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import * as Sentry from "@sentry/node";
import { FulfillmentType, OrderStatus, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { generateOrderCode } from "../lib/order-code";
import { computeDeliveryFee, getSettings } from "../lib/settings";
import { requireAuth } from "../middleware/require-auth";
import { customerAuth } from "../lib/customer-auth";
import {
  sendSms,
  buildOrderConfirmedSms,
  buildOutForDeliverySms,
  buildDeliveredSms,
  buildDelayedSms,
} from "../lib/sms";
import {
  cancelOrderSchema,
  orderListQuerySchema,
  orderLookupSchema,
  placeOrderSchema,
} from "@es-market/core";

// Order endpoints; mounted at /api in index.ts.
export const ordersRouter = Router();

class InsufficientStockError extends Error {}

function englishName(value: Prisma.JsonValue): string {
  return typeof value === "object" && value !== null && "en" in value
    ? String((value as { en: unknown }).en)
    : "product";
}

// A code collision aborts the whole Postgres transaction, so the retry loop
// wraps the transaction rather than the create.
const CODE_RETRIES = 5;

// Items include the product's images (just that one column) so
// serializePublicOrder can attach a current thumbnail — the FK is required
// and Product rows are only ever soft-deleted, never hard-deleted, so
// item.product always resolves even for a since-deleted/edited product
// (the thumbnail may then reflect the product's current image, not
// necessarily what shipped — same "history must show what was charged, not
// necessarily what it looked like" tradeoff already accepted for
// productName/unitPrice's own snapshot-vs-live split).
export const orderWithItems = {
  items: { include: { product: { select: { images: true } } } },
} as const;

// Guest/customer-safe order shape — omits customerPhone/customerId
// (internal-only fields; see serializeOrder below for the staff version that
// includes them). Shared by the order-create response, the guest lookup
// route, and the signed-in customer's order-history list — all three are
// always the customer looking at their own order, so customerName/address
// are safe to include (unlike customerPhone, neither is used as a lookup
// credential, and the lookup route already gates on an exact phone match
// before any of this is ever serialized — see orders.ts's /lookup route).
export function serializePublicOrder(
  order: Prisma.OrderGetPayload<{ include: typeof orderWithItems }>,
) {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  return {
    code: order.code,
    status: order.status,
    fulfillmentType: order.fulfillmentType,
    customerName: order.customerName,
    address: order.address,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    subtotal,
    deliveryFee: order.deliveryFee,
    total: subtotal + order.deliveryFee,
    items: order.items.map((item) => ({
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      imageUrl: item.product.images[0] ?? null,
    })),
  };
}

ordersRouter.post("/storefront/orders", async (req, res) => {
  const parsed = placeOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { customerName, customerPhone, fulfillmentType, address, items } = parsed.data;

  // Merge duplicate entries for the same product into one quantity.
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...quantities.keys()] }, deletedAt: null },
  });
  if (products.length !== quantities.size) {
    res.status(400).json({ error: "Product not found" });
    return;
  }

  // Totals always come from DB prices, never from the client.
  const subtotal = products.reduce(
    (sum, product) => sum + product.price * quantities.get(product.id)!,
    0,
  );
  const deliveryFee = computeDeliveryFee(subtotal, fulfillmentType, await getSettings());

  // Soft/optional auth: this route stays public for guests either way — if a
  // valid customer session cookie happens to be present, the order is linked
  // to that account, but nothing here requires or blocks on it.
  const customerSession = await customerAuth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  for (let attempt = 0; attempt < CODE_RETRIES; attempt++) {
    const code = generateOrderCode();
    try {
      const order = await prisma.$transaction(async (tx) => {
        for (const product of products) {
          const quantity = quantities.get(product.id)!;
          // Guarded decrement: the stock >= quantity condition makes the
          // check-and-decrement race-safe under concurrent orders.
          const updated = await tx.product.updateMany({
            where: { id: product.id, deletedAt: null, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          });
          if (updated.count !== 1) {
            throw new InsufficientStockError(englishName(product.name));
          }
        }
        return tx.order.create({
          data: {
            id: randomUUID(),
            code,
            fulfillmentType,
            customerName,
            customerPhone,
            address: address ?? null,
            customerId: customerSession?.user.id ?? null,
            deliveryFee,
            items: {
              create: products.map((product) => ({
                id: randomUUID(),
                productId: product.id,
                productName: product.name as Prisma.InputJsonValue,
                unitPrice: product.price,
                quantity: quantities.get(product.id)!,
              })),
            },
          },
          include: { items: true },
        });
      });

      // Re-fetch with the shape serializePublicOrder expects (product images
      // for the thumbnail) rather than hand-building a second, narrower
      // response object — an earlier inline version omitted
      // address/customerName/createdAt/updatedAt entirely, which silently
      // broke the checkout page's "save this address to my profile"
      // write-back (order.address came back undefined) and would have done
      // the same to any other consumer relying on serializePublicOrder's
      // documented response shape.
      const orderWithImages = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderWithItems,
      });
      res.status(201).json({ order: serializePublicOrder(orderWithImages) });
      return;
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        res.status(409).json({ error: `Not enough stock for ${err.message}` });
        return;
      }
      // Unique collision on the order code — roll the dice again.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  res.status(500).json({ error: "Could not generate an order code, please try again" });
});

export function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, "");
}

// Public customer status lookup by order code + phone. A wrong phone gets the
// same 404 as an unknown code so codes stay non-enumerable.
ordersRouter.get("/storefront/orders/lookup", async (req, res) => {
  const parsed = orderLookupSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { code, phone } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { code },
    include: orderWithItems,
  });
  if (!order || normalizePhone(order.customerPhone) !== normalizePhone(phone)) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json({ order: serializePublicOrder(order) });
});

// --- Staff endpoints (any signed-in staff: ADMIN or AGENT) ---

function serializeOrder(
  order: Prisma.OrderGetPayload<{ include: typeof orderWithItems }>,
) {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  return { ...order, subtotal, total: subtotal + order.deliveryFee };
}

ordersRouter.get("/orders", requireAuth, async (req, res) => {
  const parsed = orderListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { status } = parsed.data;
  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,
    include: orderWithItems,
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders: orders.map(serializeOrder) });
});

ordersRouter.get<{ id: string }>("/orders/:id", requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    // smsLogs only on the single-order detail route, not the list or any
    // public/customer route — staff-internal visibility into whether the
    // customer was actually notified, not something to expose more widely.
    include: { ...orderWithItems, smsLogs: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json({ order: serializeOrder(order) });
});

// 404 when the order doesn't exist, 409 when it exists but a guarded
// status-transition updateMany matched nothing (wrong current status).
async function rejectMissingOrConflict(res: Response, id: string, conflictMessage: string) {
  const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.status(409).json({ error: conflictMessage });
}

// Returns the serialized order so callers that need to act on it afterward
// (e.g. firing a status-change SMS) can, without a second DB round-trip.
async function respondWithOrder(res: Response, id: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: orderWithItems,
  });
  const serialized = serializeOrder(order);
  res.json({ order: serialized });
  return serialized;
}

// Fire-and-forget — an SMS failure must never affect the (already-sent)
// HTTP response for a successful status transition. Logged the same way
// classifyInquiry's fire-and-forget AI call is in inquiries.ts.
function fireOrderSms(orderId: string, phone: string, message: string) {
  void sendSms(phone, message, { orderId }).catch((error) => {
    console.error("Order status SMS failed:", error);
    Sentry.captureException(error, { extra: { orderId } });
  });
}

// Records a failed confirmation call on a received order.
ordersRouter.post<{ id: string }>("/orders/:id/call-attempt", requireAuth, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.order.updateMany({
    where: { id, status: OrderStatus.RECEIVED },
    data: { callAttempts: { increment: 1 } },
  });
  if (updated.count === 0) {
    await rejectMissingOrConflict(res, id, "Only received orders can log call attempts");
    return;
  }
  await respondWithOrder(res, id);
});

// The staff member reached the customer and confirmed the order over the phone.
ordersRouter.post<{ id: string }>("/orders/:id/confirm", requireAuth, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.order.updateMany({
    where: { id, status: OrderStatus.RECEIVED },
    data: { status: OrderStatus.CONFIRMED },
  });
  if (updated.count === 0) {
    await rejectMissingOrConflict(res, id, "Only received orders can be confirmed");
    return;
  }
  const order = await respondWithOrder(res, id);
  fireOrderSms(id, order.customerPhone, buildOrderConfirmedSms({ code: order.code, total: order.total }));
});

// Marks a confirmed delivery order as dispatched. Pickup orders skip this step.
ordersRouter.post<{ id: string }>("/orders/:id/out-for-delivery", requireAuth, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.order.updateMany({
    where: {
      id,
      status: OrderStatus.CONFIRMED,
      fulfillmentType: FulfillmentType.DELIVERY,
    },
    data: { status: OrderStatus.OUT_FOR_DELIVERY },
  });
  if (updated.count === 0) {
    await rejectMissingOrConflict(res, id, "Only confirmed delivery orders can go out for delivery");
    return;
  }
  const order = await respondWithOrder(res, id);
  fireOrderSms(id, order.customerPhone, buildOutForDeliverySms({ code: order.code, total: order.total }));
});

// Completes an order: delivery once dispatched, pickup straight from confirmed.
ordersRouter.post<{ id: string }>("/orders/:id/complete", requireAuth, async (req, res) => {
  const { id } = req.params;
  const updated = await prisma.order.updateMany({
    where: {
      id,
      OR: [
        { fulfillmentType: FulfillmentType.DELIVERY, status: OrderStatus.OUT_FOR_DELIVERY },
        { fulfillmentType: FulfillmentType.PICKUP, status: OrderStatus.CONFIRMED },
      ],
    },
    data: { status: OrderStatus.COMPLETED },
  });
  if (updated.count === 0) {
    await rejectMissingOrConflict(res, id, "Order is not ready to be completed");
    return;
  }
  const order = await respondWithOrder(res, id);
  fireOrderSms(id, order.customerPhone, buildDeliveredSms({ code: order.code }));
});

// Staff-triggered "delayed" notice — does not change Order.status (there is
// no DELAYED value in OrderStatus by design; the order stays wherever it
// currently is). Fire-and-forget elsewhere would leave staff with no signal
// that the SMS actually went out, so this route awaits sendSms and reports
// success/failure for the admin UI to show.
ordersRouter.post<{ id: string }>("/orders/:id/notify-delayed", requireAuth, async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const settings = await getSettings();
  try {
    await sendSms(
      order.customerPhone,
      buildDelayedSms({ code: order.code, contactPhone: settings.contactPhone }),
      { orderId: id },
    );
    res.json({ sent: true });
  } catch (error) {
    console.error("Delayed-order SMS failed:", error);
    Sentry.captureException(error, { extra: { orderId: id } });
    res.status(502).json({ sent: false, error: "Could not send the delayed notice" });
  }
});

// Cancels a not-yet-dispatched order and restores the items' stock.
ordersRouter.post<{ id: string }>("/orders/:id/cancel", requireAuth, async (req, res) => {
  const parsed = cancelOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { id } = req.params;

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id, status: { in: [OrderStatus.RECEIVED, OrderStatus.CONFIRMED] } },
      data: { status: OrderStatus.CANCELLED, cancelReason: parsed.data.reason },
    });
    if (updated.count === 0) return false;

    const items = await tx.orderItem.findMany({ where: { orderId: id } });
    for (const item of items) {
      // Restore even if the product has been soft-deleted since the order.
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
    return true;
  });

  if (!cancelled) {
    await rejectMissingOrConflict(res, id, "Only received or confirmed orders can be cancelled");
    return;
  }
  await respondWithOrder(res, id);
});
