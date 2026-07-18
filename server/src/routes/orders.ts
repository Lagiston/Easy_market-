import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { generateOrderCode } from "../lib/order-code";
import { computeDeliveryFee, getSettings } from "../lib/settings";
import { placeOrderSchema } from "@es-market/core";

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
