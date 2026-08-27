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

// Hard-deletes the product, its reviews, and any orders placed for it, so
// repeated runs against the shared test DB don't accumulate rows. Orders go
// first (their items reference the product); order_item rows cascade with
// the order. Reviews are deleted explicitly (no cascade from product).
async function cleanupProduct(productId: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "review" WHERE "productId" = $1', [productId]);
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

test.describe("Customer account deletion", () => {
  test("wrong password keeps the account intact; correct password anonymizes orders/reviews and deletes the account", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Deletion Product ${unique}`;
    const productId = await seedProduct({ name, price: 55, stock: 5 });
    const email = `e2e-deleter-${unique}@e2e.test`;
    const password = "deleter-password-123";
    const customerName = "E2E Deleter";
    let customerId: string | undefined;

    try {
      // Sign up as a brand-new customer.
      await page.goto("/account/signup");
      await page.getByLabel("Name").fill(customerName);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign up" }).click();
      await expect(page).toHaveURL("/account");

      // Place a pickup order for the product while signed in, so there's a
      // real order to be anonymized rather than deleted.
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await page.getByRole("button", { name: "Add to cart" }).click();

      await page.goto("/checkout");
      await page.getByLabel(/Full name/).fill(customerName);
      await page.getByLabel(/^Phone \*$/).fill("700777888");
      await page.getByRole("button", { name: "Store pickup" }).click();
      await page.getByRole("button", { name: /Place order/ }).click();
      await expect(page).toHaveURL("/checkout/confirmation");
      await expect(
        page.getByRole("heading", { name: "Thank you for your order!" }),
      ).toBeVisible();
      const orderCode = (
        await page.getByText(/^[A-HJ-NP-Z2-9]{8}$/).textContent()
      )?.trim();
      expect(orderCode).toBeTruthy();

      // Submit a review for the same product while signed in.
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      const comment = `Loved it ${unique}`;
      await page.getByRole("button", { name: "Rate 5 stars" }).click();
      await page.getByLabel("Comment (optional)").fill(comment);
      await page.getByRole("button", { name: "Submit review" }).click();
      const reviewItem = page.getByText(comment).locator("..");
      await expect(reviewItem.getByText(customerName)).toBeVisible();

      // Confirm the order and review are actually linked to the customer
      // before deletion, so the anonymization assertions below are meaningful.
      const before = await withDb((client) =>
        client.query(
          `SELECT o."customerId" AS "orderCustomerId", r."customerId" AS "reviewCustomerId", c.id AS "customerId"
           FROM "order" o
           JOIN "review" r ON r."productId" = $1
           JOIN "customer" c ON c.email = $2
           WHERE o.code = $3`,
          [productId, email, orderCode],
        ),
      );
      expect(before.rows).toHaveLength(1);
      expect(before.rows[0].orderCustomerId).toBe(before.rows[0].customerId);
      expect(before.rows[0].reviewCustomerId).toBe(before.rows[0].customerId);
      customerId = before.rows[0].customerId;

      // Open the danger zone and try the wrong password first.
      await page.goto("/account/profile");
      await page
        .getByRole("button", { name: "Delete my account" })
        .click();
      await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
      await page.getByLabel("Password").fill("totally-wrong-password");
      await page.getByRole("button", { name: "Delete account" }).click();

      await expect(page.getByText("Incorrect password")).toBeVisible();
      // Dialog stays open and the account/session are still intact.
      await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("link", { name: customerName })).toBeVisible();

      const stillExists = await withDb((client) =>
        client.query('SELECT id FROM "customer" WHERE email = $1', [email]),
      );
      expect(stillExists.rows).toHaveLength(1);

      // Now delete for real with the correct password.
      await page
        .getByRole("button", { name: "Delete my account" })
        .click();
      await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Delete account" }).click();

      // Redirected home, signed out.
      await expect(page).toHaveURL("/");
      await expect(page.getByText("Your account has been deleted.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

      // A subsequent visit to a protected account route now redirects to login.
      await page.goto("/account");
      await expect(page).toHaveURL("/account/login");

      // DB assertions: the customer row is gone; order/review are anonymized,
      // not deleted, and their other data is untouched; session/account rows
      // for that customer are gone too.
      const afterCustomer = await withDb((client) =>
        client.query('SELECT id FROM "customer" WHERE email = $1', [email]),
      );
      expect(afterCustomer.rows).toHaveLength(0);

      const afterOrder = await withDb((client) =>
        client.query(
          'SELECT "customerId", "customerName", address FROM "order" WHERE code = $1',
          [orderCode],
        ),
      );
      expect(afterOrder.rows).toHaveLength(1);
      expect(afterOrder.rows[0].customerId).toBeNull();
      expect(afterOrder.rows[0].customerName).toBe(customerName);

      const afterReview = await withDb((client) =>
        client.query(
          'SELECT "customerId", "authorName", comment FROM "review" WHERE "productId" = $1',
          [productId],
        ),
      );
      expect(afterReview.rows).toHaveLength(1);
      expect(afterReview.rows[0].customerId).toBeNull();
      expect(afterReview.rows[0].authorName).toBe(customerName);
      expect(afterReview.rows[0].comment).toBe(comment);

      const afterSessionsAndAccounts = await withDb((client) =>
        client.query(
          `SELECT
             (SELECT count(*) FROM "customer_session" WHERE "customerId" = $1) AS sessions,
             (SELECT count(*) FROM "customer_account" WHERE "customerId" = $1) AS accounts`,
          [customerId],
        ),
      );
      expect(Number(afterSessionsAndAccounts.rows[0].sessions)).toBe(0);
      expect(Number(afterSessionsAndAccounts.rows[0].accounts)).toBe(0);
    } finally {
      await cleanupProduct(productId);
      if (email) await cleanupCustomer(email);
    }
  });
});
