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
  fulfillmentType = "PICKUP",
  customerPhone = "+255700999888",
}: {
  stockAfterOrder: number;
  quantity: number;
  fulfillmentType?: "PICKUP" | "DELIVERY";
  customerPhone?: string;
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
         (id, code, status, "fulfillmentType", "customerName", "customerPhone", address, "deliveryFee", "updatedAt")
       VALUES ($1, $2, 'RECEIVED', $3, 'E2E Customer', $6, $4, $5, now())`,
      [
        orderId,
        code,
        fulfillmentType,
        fulfillmentType === "DELIVERY" ? "123 E2E Street" : null,
        fulfillmentType === "DELIVERY" ? 50 : 0,
        customerPhone,
      ],
    );
    await client.query(
      `INSERT INTO "order_item" (id, "orderId", "productId", "productName", "unitPrice", quantity)
       VALUES ($1, $2, $3, $4::jsonb, 150, $5)`,
      [randomUUID(), orderId, productId, JSON.stringify({ en: productName }), quantity],
    );
    return { orderId, code, productId };
  });
}

// sendSms() is fire-and-forget from most call sites (confirm/out-for-delivery/
// complete), so the SmsLog row may not exist yet the instant the HTTP
// response returns — poll briefly rather than asserting immediately.
async function pollSmsLogRow(
  where: { orderId?: string; inquiryId?: string },
  { timeoutMs = 5000, intervalMs = 200 } = {},
): Promise<{ to: string; status: string } | null> {
  const column = where.orderId ? "orderId" : "inquiryId";
  const value = where.orderId ?? where.inquiryId;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await withDb((client) =>
      client.query(`SELECT "to", status FROM "sms_log" WHERE "${column}" = $1 LIMIT 1`, [value]),
    );
    if (found.rows.length > 0) return found.rows[0];
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
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

test.describe("Notify customer of delay", () => {
  test("appears for a confirmed order, sends without changing status, and is absent for a received order", async ({
    page,
  }) => {
    const seeded = await seedReceivedOrder({ stockAfterOrder: 4, quantity: 1 });
    const { code } = seeded;

    try {
      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
      await page.goto(`/admin/orders/${seeded.orderId}`);

      // RECEIVED: no delay-notice action yet.
      await expect(page.getByText("Received", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Notify customer of delay" }),
      ).toBeHidden();

      await page.getByRole("button", { name: "Confirm order" }).click();
      await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

      const notifyButton = page.getByRole("button", { name: "Notify customer of delay" });
      await expect(notifyButton).toBeVisible();
      await notifyButton.click();

      await expect(page.getByText("Delayed notice sent.")).toBeVisible();
      // Status is unchanged — this action never transitions the order, even
      // when SMS is unset in this environment (sendSms no-ops safely).
      await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

      const persisted = await withDb((client) =>
        client.query('SELECT status FROM "order" WHERE id = $1', [seeded.orderId]),
      );
      expect(persisted.rows[0].status).toBe("CONFIRMED");

      // notify-delayed awaits sendSms server-side (unlike confirm's own
      // fire-and-forget SMS), so the log row is guaranteed to exist by the
      // time the "Delayed notice sent." success text renders — no polling
      // needed here. The detail page's SMS section isn't invalidated by this
      // mutation though, so a reload is required to see it.
      await page.reload();
      await expect(page.getByRole("heading", { name: "SMS notifications" })).toBeVisible();
      await expect(
        page.getByText("Not sent (no SMS provider configured)").first(),
      ).toBeVisible();
    } finally {
      await cleanupOrder(seeded);
    }
  });
});

test.describe("SMS notification logging", () => {
  test("confirming an order logs an SmsLog row with the phone normalized to E.164, shown as unsent (no SMS provider configured)", async ({
    page,
  }) => {
    // Local-format phone (no country code) — checks that sendSms's toE164()
    // normalization is actually what gets persisted, not the raw input.
    const seeded = await seedReceivedOrder({
      stockAfterOrder: 4,
      quantity: 1,
      customerPhone: "0712345678",
    });

    try {
      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
      await page.goto(`/admin/orders/${seeded.orderId}`);

      await expect(page.getByText("Received", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Confirm order" }).click();
      await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

      // The confirmation SMS is fire-and-forget server-side, so poll the DB
      // rather than asserting the row exists the instant the UI updates.
      const row = await pollSmsLogRow({ orderId: seeded.orderId });
      expect(row).not.toBeNull();
      expect(row!.status).toBe("SKIPPED");
      // "0712345678" -> "+255712345678": leading 0 replaced with the +255
      // country code, per toE164()'s local-number branch.
      expect(row!.to).toBe("+255712345678");

      // Confirmed a real DB write; now confirm the UI (a fresh detail-page
      // load, since the invalidated ["orders", id] query may have refetched
      // before the fire-and-forget write above landed) reflects it too.
      await page.reload();
      await expect(page.getByRole("heading", { name: "SMS notifications" })).toBeVisible();
      await expect(
        page.getByText("Not sent (no SMS provider configured)").first(),
      ).toBeVisible();
    } finally {
      await cleanupOrder(seeded);
    }
  });
});

test.describe("Order lifecycle", () => {
  test("delivery order runs the full lifecycle: confirm → out for delivery → complete, and the detail page shows COMPLETED", async ({
    page,
  }) => {
    const seeded = await seedReceivedOrder({
      stockAfterOrder: 5,
      quantity: 1,
      fulfillmentType: "DELIVERY",
    });
    const { code } = seeded;

    try {
      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
      await page.goto("/admin/orders");

      const row = page.getByRole("row", { name: code });
      await expect(row).toContainText("Received");

      await row.getByRole("button", { name: `Confirm order ${code}` }).click();
      await expect(row).toContainText("Confirmed");

      await row
        .getByRole("button", { name: `Mark order ${code} out for delivery` })
        .click();
      await expect(row).toContainText("Out for delivery");

      await row.getByRole("button", { name: `Complete order ${code}` }).click();
      await expect(row).toContainText("Completed");
      // Terminal status: no further actions in the row.
      await expect(row.getByRole("button")).toHaveCount(0);

      // The order code links to the new staff detail page; it re-fetches from
      // GET /api/orders/:id, so the COMPLETED status shown there is persisted truth.
      await row.getByRole("link", { name: code }).click();
      await expect(page).toHaveURL(`/admin/orders/${seeded.orderId}`);
      await expect(page.getByText("Completed")).toBeVisible();
      await expect(page.getByText("123 E2E Street")).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel order" })).toBeHidden();

      const persisted = await withDb((client) =>
        client.query('SELECT status FROM "order" WHERE id = $1', [seeded.orderId]),
      );
      expect(persisted.rows[0].status).toBe("COMPLETED");
    } finally {
      await cleanupOrder(seeded);
    }
  });

  test("cancelling with a chosen reason marks the order CANCELLED and restores product stock", async ({
    page,
  }) => {
    const quantity = 3;
    const stockAfterOrder = 4;
    const seeded = await seedReceivedOrder({ stockAfterOrder, quantity });
    const { code } = seeded;

    try {
      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
      await page.goto("/admin/orders");

      const row = page.getByRole("row", { name: code });
      await expect(row).toContainText("Received");

      await row.getByRole("button", { name: `Cancel order ${code}` }).click();
      const dialog = page.getByRole("dialog", { name: `Cancel order ${code}?` });
      await expect(dialog).toBeVisible();

      // Pick the reason in the dialog's Select, then submit.
      await dialog.getByRole("combobox", { name: "Reason" }).click();
      await page.getByRole("option", { name: "Customer request" }).click();
      await dialog.getByRole("button", { name: "Cancel order" }).click();

      await expect(dialog).toBeHidden();
      await expect(row).toContainText("Cancelled");

      // DB truth: cancelled with the chosen reason, and the transaction
      // restored the product's stock by the ordered quantity.
      const persisted = await withDb((client) =>
        client.query(
          `SELECT o.status, o."cancelReason", p.stock
           FROM "order" o
           JOIN "order_item" i ON i."orderId" = o.id
           JOIN "product" p ON p.id = i."productId"
           WHERE o.id = $1`,
          [seeded.orderId],
        ),
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0].status).toBe("CANCELLED");
      expect(persisted.rows[0].cancelReason).toBe("CUSTOMER_REQUEST");
      expect(persisted.rows[0].stock).toBe(stockAfterOrder + quantity);
    } finally {
      await cleanupOrder(seeded);
    }
  });
});
