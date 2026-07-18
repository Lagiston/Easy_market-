import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { OrderStatus, Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { generateOrderCode } from "../lib/order-code";
import { computeDeliveryFee, getSettings } from "../lib/settings";
import { requireAuth } from "../middleware/require-auth";
import { cancelOrderSchema, orderLookupSchema, placeOrderSchema } from "@es-market/core";

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

      res.status(201).json({
        order: {
          code: order.code,
          status: order.status,
          fulfillmentType: order.fulfillmentType,
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          items: order.items.map((item) => ({
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
        },
      });
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

function normalizePhone(value: string): string {
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
    include: { items: true },
  });
  if (!order || normalizePhone(order.customerPhone) !== normalizePhone(phone)) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  res.json({
    order: {
      code: order.code,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      createdAt: order.createdAt,
      subtotal,
      deliveryFee: order.deliveryFee,
      total: subtotal + order.deliveryFee,
      items: order.items.map((item) => ({
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    },
  });
});

// --- Staff endpoints (any signed-in staff: ADMIN or AGENT) ---

const orderWithItems = { items: true } as const;

function serializeOrder(
  order: Prisma.OrderGetPayload<{ include: typeof orderWithItems }>,
) {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  return { ...order, subtotal, total: subtotal + order.deliveryFee };
}

ordersRouter.get("/orders", requireAuth, async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: orderWithItems,
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders: orders.map(serializeOrder) });
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

async function respondWithOrder(res: Response, id: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: orderWithItems,
  });
  res.json({ order: serializeOrder(order) });
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
  await respondWithOrder(res, id);
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
