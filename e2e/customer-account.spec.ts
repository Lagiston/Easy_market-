import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./test-env";

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Seeds a storefront-visible product directly in the test DB, mirroring
// checkout.spec.ts's seedProduct (no public product-creation flow exists).
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
// items reference the product, and an order may reference a customer);
// order_item rows cascade with the order.
async function cleanupProduct(productId: string) {
  await withDb(async (client) => {
    await client.query(
      'DELETE FROM "order" WHERE id IN (SELECT "orderId" FROM "order_item" WHERE "productId" = $1)',
      [productId],
    );
    await client.query('DELETE FROM "product" WHERE id = $1', [productId]);
  });
}

// customer_session/customer_account cascade-delete with the customer row.
async function cleanupCustomer(email: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "customer" WHERE email = $1', [email]);
  });
}

test.describe("Customer accounts", () => {
  test("signs up, places an order while signed in, and sees it on /account/orders", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Account Product ${unique}`;
    const price = 75;
    const productId = await seedProduct({ name, price, stock: 5 });
    const email = `e2e-customer-${unique}@e2e.test`;
    const password = "customer-password-123";

    try {
      // Sign up as a brand-new customer.
      await page.goto("/account/signup");
      await page.getByLabel("Name").fill("E2E Customer");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign up" }).click();
      await expect(page).toHaveURL("/account");

      // Header reflects the signed-in state.
      await expect(page.getByRole("link", { name: "E2E Customer" })).toBeVisible();

      // Add the seeded product to the cart and check out as a delivery order.
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await page.getByRole("button", { name: "Add to cart" }).click();

      await page.goto("/checkout");
      await expect(page.getByLabel("Delivery or pickup")).toContainText("Delivery");
      await page.getByLabel("Name").fill("E2E Customer");
      await page.getByLabel("Phone", { exact: true }).fill("+255700111222");
      await page.getByLabel("Address").fill("1 Account Lane");
      await page.getByRole("button", { name: "Place order" }).click();

      await expect(page).toHaveURL("/checkout/confirmation");
      await expect(
        page.getByRole("heading", { name: "Thank you for your order!" }),
      ).toBeVisible();
      const orderCode = (
        await page.getByText(/^[A-HJ-NP-Z2-9]{8}$/).textContent()
      )?.trim();
      expect(orderCode).toBeTruthy();

      // The order shows up in the signed-in customer's order history.
      await page.goto("/account/orders");
      await expect(page.getByText(orderCode!, { exact: true })).toBeVisible();
      await expect(page.getByText(`${name} × 1`)).toBeVisible();

      // Real DB persistence: the order is actually linked to the customer row.
      const persisted = await withDb((client) =>
        client.query(
          `SELECT o."customerId", c.email
           FROM "order" o
           JOIN "customer" c ON c.id = o."customerId"
           WHERE o.code = $1`,
          [orderCode],
        ),
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0].email).toBe(email);
    } finally {
      await cleanupProduct(productId);
      await cleanupCustomer(email);
    }
  });

  test("guest checkout still succeeds with no customer account involved", async ({ page }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Guest Product ${unique}`;
    const price = 60;
    const productId = await seedProduct({ name, price, stock: 5 });

    try {
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await page.getByRole("button", { name: "Add to cart" }).click();

      // Header shows the signed-out "Sign in" affordance, confirming no
      // customer session leaks in from a previous test/browser state.
      await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

      await page.goto("/checkout");
      await page.getByLabel("Name").fill("E2E Guest");
      await page.getByLabel("Phone", { exact: true }).fill("+255700333444");
      await page.getByLabel("Address").fill("2 Guest Road");
      await page.getByRole("button", { name: "Place order" }).click();

      await expect(page).toHaveURL("/checkout/confirmation");
      await expect(
        page.getByRole("heading", { name: "Thank you for your order!" }),
      ).toBeVisible();
      const orderCode = (
        await page.getByText(/^[A-HJ-NP-Z2-9]{8}$/).textContent()
      )?.trim();
      expect(orderCode).toBeTruthy();

      // Placed with no signed-in session, so customerId stays null.
      const persisted = await withDb((client) =>
        client.query('SELECT "customerId" FROM "order" WHERE code = $1', [orderCode]),
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0].customerId).toBeNull();
    } finally {
      await cleanupProduct(productId);
    }
  });

  test("an unauthenticated visit to /account redirects to /account/login", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL("/account/login");
  });
});
