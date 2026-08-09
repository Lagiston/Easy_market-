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

// Seeds a product with stock below its low-stock threshold so the dashboard's
// "Low-stock items" card has real data to link into.
async function seedLowStockProduct() {
  return withDb(async (client) => {
    const category = await client.query(
      'SELECT id FROM "category" WHERE "deletedAt" IS NULL LIMIT 1',
    );
    if (category.rows.length === 0) {
      throw new Error("No category found in the test DB — did setup-db.ts run?");
    }
    const productId = randomUUID();
    const productName = `Dashboard E2E Low Stock ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await client.query(
      `INSERT INTO "product" (id, name, price, stock, "lowStockThreshold", "categoryId", "updatedAt")
       VALUES ($1, $2::jsonb, 100, 1, 5, $3, now())`,
      [productId, JSON.stringify({ en: productName }), category.rows[0].id],
    );
    return { productId, productName };
  });
}

async function cleanupProduct(productId: string) {
  await withDb((client) => client.query('DELETE FROM "product" WHERE id = $1', [productId]));
}

test.describe("Admin dashboard deep links", () => {
  test("clicking the Low-stock items card navigates to Products pre-sorted by stock ascending", async ({
    page,
  }) => {
    const { productId, productName } = await seedLowStockProduct();

    try {
      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
      await page.goto("/admin");

      const card = page.getByRole("link", { name: /Low-stock items/ });
      await expect(card).toBeVisible();
      await card.click();

      await expect(page).toHaveURL("/admin/products?sortBy=stock&sortOrder=asc");

      // The seeded product (stock 1, below every other seeded product) sorts
      // first — real confirmation that the URL's sortBy/sortOrder actually
      // drove the query, not just that the Stock column has a sort affordance.
      const rows = page.getByRole("row");
      await expect(rows.nth(1)).toContainText(productName);
    } finally {
      await cleanupProduct(productId);
    }
  });

  test("clicking the Orders awaiting confirmation card navigates to Orders pre-filtered to Received", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin");

    const card = page.getByRole("link", { name: /Orders awaiting confirmation/ });
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL("/admin/orders?status=RECEIVED");
    await expect(page.getByRole("tab", { name: "Received" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
