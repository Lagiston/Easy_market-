import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { loginAs } from "./helpers";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_DATABASE_URL } from "./test-env";

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Unique order code from the phone-friendly alphabet (no O/0/I/1) so the row
// is unambiguous in the table and never collides across parallel tests.
function uniqueOrderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 8 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

// Seeds a product plus a RECEIVED order for it directly in the test DB (the
// staff confirmation flow starts from an already-placed order; going through
// the storefront checkout here would couple this spec to it). The product's
// stock is seeded as the post-order value, mirroring checkout's decrement.
async function seedReceivedOrder({
  stockAfterOrder,
  quantity,
}: {
  stockAfterOrder: number;
  quantity: number;
}) {
  return withDb(async (client) => {
    const category = await client.query(
      'SELECT id FROM "category" WHERE "deletedAt" IS NULL LIMIT 1',
    );
    if (category.rows.length === 0) {
      throw new Error("No category found in the test DB — did setup-db.ts run?");
    }
    const productId = randomUUID();
    const productName = `Orders E2E Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await client.query(
      `INSERT INTO "product" (id, name, price, stock, "categoryId", "updatedAt")
       VALUES ($1, $2::jsonb, 150, $3, $4, now())`,
      [productId, JSON.stringify({ en: productName }), stockAfterOrder, category.rows[0].id],
    );

    const orderId = randomUUID();
    const code = uniqueOrderCode();
    await client.query(
      `INSERT INTO "order"
         (id, code, status, "fulfillmentType", "customerName", "customerPhone", "deliveryFee", "updatedAt")
       VALUES ($1, $2, 'RECEIVED', 'PICKUP', 'E2E Customer', '+255700999888', 0, now())`,
      [orderId, code],
    );
    await client.query(
      `INSERT INTO "order_item" (id, "orderId", "productId", "productName", "unitPrice", quantity)
       VALUES ($1, $2, $3, $4::jsonb, 150, $5)`,
      [randomUUID(), orderId, productId, JSON.stringify({ en: productName }), quantity],
    );
    return { orderId, code, productId };
  });
}

// Order first (its items reference the product and cascade with it), then the product.
async function cleanupOrder({ orderId, productId }: { orderId: string; productId: string }) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "order" WHERE id = $1', [orderId]);
    await client.query('DELETE FROM "product" WHERE id = $1', [productId]);
  });
}

test.describe("Staff phone-confirmation flow", () => {
  test("staff logs 3 failed calls (persisted), then cancels the unreachable order — status Cancelled and stock restored", async ({
    page,
  }) => {
    const quantity = 2;
    const stockAfterOrder = 3;
    const seeded = await seedReceivedOrder({ stockAfterOrder, quantity });
    const { code } = seeded;

    try {
      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
      await page.goto("/admin/orders");

      const row = page.getByRole("row", { name: code });
      await expect(row).toContainText("Received");

      // Cancel action is hidden until enough failed calls are logged.
      const cancelButton = row.getByRole("button", {
        name: `Cancel unreachable order ${code}`,
      });
      await expect(row.getByRole("button", { name: `Log failed call for ${code}` })).toBeVisible();
      await expect(cancelButton).toBeHidden();

      // Log three failed calls; the attempts cell (5th column) tracks each one.
      const attemptsCell = row.getByRole("cell").nth(4);
      for (let attempt = 1; attempt <= 3; attempt++) {
        await row.getByRole("button", { name: `Log failed call for ${code}` }).click();
        await expect(attemptsCell).toHaveText(String(attempt));
      }
      await expect(cancelButton).toBeVisible();

      // Real persistence: the attempt count survives a full reload.
      await page.reload();
      await expect(attemptsCell).toHaveText("3");
      await expect(cancelButton).toBeVisible();

      // Cancel as unreachable via the confirmation dialog.
      await cancelButton.click();
      const dialog = page.getByRole("alertdialog", { name: `Cancel order ${code}?` });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel order" }).click();

      await expect(dialog).toBeHidden();
      await expect(row).toContainText("Cancelled");
      // Non-RECEIVED orders have no phone actions.
      await expect(
        row.getByRole("button", { name: `Log failed call for ${code}` }),
      ).toBeHidden();

      // DB truth: cancelled with the unreachable reason, and the transaction
      // restored the product's stock by the ordered quantity.
      const persisted = await withDb((client) =>
        client.query(
          `SELECT o.status, o."cancelReason", o."callAttempts", p.stock
           FROM "order" o
           JOIN "order_item" i ON i."orderId" = o.id
           JOIN "product" p ON p.id = i."productId"
           WHERE o.id = $1`,
          [seeded.orderId],
        ),
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0].status).toBe("CANCELLED");
      expect(persisted.rows[0].cancelReason).toBe("CUSTOMER_UNREACHABLE");
      expect(persisted.rows[0].callAttempts).toBe(3);
      expect(persisted.rows[0].stock).toBe(stockAfterOrder + quantity);
    } finally {
      await cleanupOrder(seeded);
    }
  });

  test("confirming a received order persists the CONFIRMED status across reload", async ({
    page,
  }) => {
    const seeded = await seedReceivedOrder({ stockAfterOrder: 4, quantity: 1 });
    const { code } = seeded;

    try {
      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
      await page.goto("/admin/orders");

      const row = page.getByRole("row", { name: code });
      await expect(row).toContainText("Received");
      await row.getByRole("button", { name: `Confirm order ${code}` }).click();
      await expect(row).toContainText("Confirmed");

      // Survives a reload — the transition really persisted server-side.
      await page.reload();
      await expect(row).toContainText("Confirmed");
      await expect(row.getByRole("button", { name: `Confirm order ${code}` })).toBeHidden();

      const persisted = await withDb((client) =>
        client.query('SELECT status FROM "order" WHERE id = $1', [seeded.orderId]),
      );
      expect(persisted.rows[0].status).toBe("CONFIRMED");
    } finally {
      await cleanupOrder(seeded);
    }
  });
});
