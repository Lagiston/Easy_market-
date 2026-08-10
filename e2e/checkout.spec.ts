import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./test-env";

// Order codes come from an alphabet that omits O/0 and I/1 (read over the phone).
const ORDER_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Seeds a storefront-visible product directly in the test DB (there is no
// public product-creation flow, and going through the admin UI would couple
// this spec to it). Reuses an existing seeded category for the required FK.
async function seedProduct({
  name,
  price,
  stock,
}: {
  name: string;
  price: number;
  stock: number;
}): Promise<string> {
  return withDb(async (client) => {
    const category = await client.query(
      'SELECT id FROM "category" WHERE "deletedAt" IS NULL LIMIT 1',
    );
    if (category.rows.length === 0) {
      throw new Error("No category found in the test DB — did setup-db.ts run?");
    }
    const id = randomUUID();
    await client.query(
      `INSERT INTO "product" (id, name, price, stock, "categoryId", "updatedAt")
       VALUES ($1, $2::jsonb, $3, $4, $5, now())`,
      [id, JSON.stringify({ en: name }), price, stock, category.rows[0].id],
    );
    return id;
  });
}

// Hard-deletes the product and any orders placed for it, so repeated runs
// against the shared test DB don't accumulate rows. Orders go first (their
// items reference the product); order_item rows cascade with the order.
async function cleanupProduct(productId: string) {
  await withDb(async (client) => {
    await client.query(
      'DELETE FROM "order" WHERE id IN (SELECT "orderId" FROM "order_item" WHERE "productId" = $1)',
      [productId],
    );
    await client.query('DELETE FROM "product" WHERE id = $1', [productId]);
  });
}

test.describe("Guest checkout", () => {
  test("guest adds a product to the cart, checks out as delivery, sees the order code, and stock is decremented in the DB", async ({
    page,
  }) => {
    const name = `Checkout Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const price = 120;
    const initialStock = 5;
    const productId = await seedProduct({ name, price, stock: initialStock });

    try {
      // Add to cart from the product detail page.
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await page.getByRole("button", { name: "Add to cart" }).click();

      // Header cart icon shows the count badge.
      const cartLink = page.getByRole("link", { name: "Cart" });
      await expect(cartLink).toContainText("1");

      // Cart page shows the item; bump the quantity to 2.
      await cartLink.click();
      await expect(page).toHaveURL("/cart");
      await expect(page.getByRole("link", { name })).toBeVisible();
      await page.getByRole("button", { name: `Increase quantity of ${name}` }).click();
      await expect(cartLink).toContainText("2");

      await page.getByRole("link", { name: "Proceed to checkout" }).click();
      await expect(page).toHaveURL("/checkout");

      // Delivery is the default, so the Address field is visible. With the
      // seeded default settings (fee 0), delivery shows as Free.
      await expect(page.getByLabel("Delivery or pickup")).toContainText("Delivery");
      await page.getByLabel("Name").fill("E2E Guest");
      await page.getByLabel("Phone", { exact: true }).fill("700123456");
      await page.getByLabel("Address").fill("12 Market Street");

      // Order summary reflects DB price × quantity.
      const summary = page.getByText("Order summary").locator("..");
      await expect(summary.getByText(`${name} × 2`)).toBeVisible();
      await expect(summary.getByText(String(price * 2)).first()).toBeVisible();

      await page.getByRole("button", { name: "Place order" }).click();

      // Confirmation page shows an 8-character order code prominently.
      await expect(page).toHaveURL("/checkout/confirmation");
      await expect(
        page.getByRole("heading", { name: "Thank you for your order!" }),
      ).toBeVisible();
      await expect(page.getByText("Your order code")).toBeVisible();
      const code = (
        await page
          .getByText(ORDER_CODE_PATTERN)
          .textContent()
      )?.trim();
      expect(code).toMatch(ORDER_CODE_PATTERN);

      // The cart was cleared — no count badge on the cart icon anymore.
      await expect(cartLink).not.toContainText("2");

      // Public order lookup on the merged /track page: the code from the
      // confirmation page plus the checkout phone resolves to the order, end
      // to end. "Track" no longer has a nav link (deep-link-only page now),
      // so this navigates directly. Order mode is the default, so no toggle
      // click is needed.
      await page.goto("/track");
      await page.getByLabel("Order code").fill(code!);
      await page.getByLabel("Phone number").fill("+255700123456");
      await page.getByRole("button", { name: "Check status" }).click();
      await expect(page.getByText(code!, { exact: true })).toBeVisible();
      // "Order received" appears in both the status chip and the first
      // timeline step, so use .first() to avoid a strict-mode violation.
      await expect(page.getByText("Order received").first()).toBeVisible();
      await expect(page.getByText(name)).toBeVisible();
      await expect(page.getByText("Qty 2")).toBeVisible();
      await expect(
        page.getByText("Total", { exact: true }).locator(".."),
      ).toContainText(String(price * 2));

      // Short SMS-friendly deep link (/t/:code): prefills the code
      // (uppercased), auto-detects order mode, focuses the phone field, and
      // — critically — shows nothing until the phone is confirmed. This is a
      // real end-to-end round trip through a freshly-placed order, not the
      // mocked-axios coverage in TrackPage.test.tsx.
      await page.goto(`/t/${code!.toLowerCase()}`);
      await expect(page.getByLabel("Order code")).toHaveValue(code!);
      await expect(page.getByLabel("Phone number")).toBeFocused();
      // No order data leaks before the phone is confirmed.
      await expect(page.getByText(code!, { exact: true })).not.toBeVisible();
      await expect(page.getByText(name)).not.toBeVisible();

      await page.getByLabel("Phone number").fill("+255700123456");
      await page.getByRole("button", { name: "Check status" }).click();
      await expect(page.getByText(code!, { exact: true })).toBeVisible();
      await expect(page.getByText(name)).toBeVisible();

      // Real persistence: the order row exists with a snapshot item, and the
      // product's stock was atomically decremented by the ordered quantity.
      const persisted = await withDb((client) =>
        client.query(
          `SELECT o.code, o.status, o."fulfillmentType", o."customerName", o.address,
                  i.quantity, i."unitPrice", p.stock
           FROM "order" o
           JOIN "order_item" i ON i."orderId" = o.id
           JOIN "product" p ON p.id = i."productId"
           WHERE i."productId" = $1`,
          [productId],
        ),
      );
      expect(persisted.rows).toHaveLength(1);
      const row = persisted.rows[0];
      expect(row.code).toBe(code);
      expect(row.status).toBe("RECEIVED");
      expect(row.fulfillmentType).toBe("DELIVERY");
      expect(row.customerName).toBe("E2E Guest");
      expect(row.address).toBe("12 Market Street");
      expect(row.quantity).toBe(2);
      expect(row.unitPrice).toBe(price);
      expect(row.stock).toBe(initialStock - 2);
    } finally {
      await cleanupProduct(productId);
    }
  });
});
