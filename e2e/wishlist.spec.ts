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
// product-reviews.spec.ts's seedProduct (no public product-creation flow exists).
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

// Hard-deletes the product and any wishlist_item rows referencing it, so
// repeated runs against the shared test DB don't accumulate rows.
async function cleanupProduct(productId: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "wishlist_item" WHERE "productId" = $1', [productId]);
    await client.query('DELETE FROM "product" WHERE id = $1', [productId]);
  });
}

// customer_session/customer_account/wishlist_item cascade-delete with the
// customer row (WishlistItem.customerId is onDelete: Cascade).
async function cleanupCustomer(email: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "customer" WHERE email = $1', [email]);
  });
}

test.describe("Wishlist", () => {
  test("signed-in customer adds, persists across reload, and removes a wishlisted product", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Wishlist Product ${unique}`;
    const productId = await seedProduct({ name, price: 40, stock: 5 });
    const email = `e2e-wishlist-${unique}@e2e.test`;
    const password = "wishlist-password-123";

    try {
      // Sign up as a brand-new customer.
      await page.goto("/account/signup");
      await page.getByLabel("Name").fill("E2E Wishlister");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign up" }).click();
      await expect(page).toHaveURL("/account");

      // Go to the product page and add it to the wishlist.
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();

      const wishlistButton = page.getByRole("button", { name: "Add to wishlist" });
      await expect(wishlistButton).toBeVisible();
      await expect(wishlistButton).toHaveAttribute("aria-pressed", "false");
      await wishlistButton.click();

      const removeButton = page.getByRole("button", { name: "Remove from wishlist" });
      await expect(removeButton).toBeVisible();
      await expect(removeButton).toHaveAttribute("aria-pressed", "true");

      // Real DB check: the wishlist_item row was actually created for this
      // customer + product.
      const persistedAdd = await withDb((client) =>
        client.query(
          `SELECT w.id
           FROM "wishlist_item" w
           JOIN "customer" c ON c.id = w."customerId"
           WHERE w."productId" = $1 AND c.email = $2`,
          [productId, email],
        ),
      );
      expect(persistedAdd.rows).toHaveLength(1);

      // The account wishlist page lists it.
      await page.goto("/account/wishlist");
      await expect(page.getByRole("link", { name })).toBeVisible();

      // Reload: still there — real server persistence, not optimistic client state.
      await page.reload();
      await expect(page.getByRole("link", { name })).toBeVisible();

      // Remove it via the account wishlist page's remove button.
      await page
        .getByRole("button", { name: `Remove ${name} from wishlist` })
        .click();
      await expect(page.getByRole("link", { name })).toHaveCount(0);
      await expect(
        page.getByText("You haven't wishlisted any products yet."),
      ).toBeVisible();

      // Reload: still gone — confirms real deletion server-side.
      await page.reload();
      await expect(page.getByRole("link", { name })).toHaveCount(0);
      await expect(
        page.getByText("You haven't wishlisted any products yet."),
      ).toBeVisible();

      const persistedRemove = await withDb((client) =>
        client.query('SELECT id FROM "wishlist_item" WHERE "productId" = $1', [productId]),
      );
      expect(persistedRemove.rows).toHaveLength(0);

      // The product page also reflects the removal after a fresh load.
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("button", { name: "Add to wishlist" })).toBeVisible();
    } finally {
      await cleanupProduct(productId);
      await cleanupCustomer(email);
    }
  });

  test("a signed-out visitor sees a sign-in link instead of a wishlist toggle", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Guest Wishlist Product ${unique}`;
    const productId = await seedProduct({ name, price: 25, stock: 5 });

    try {
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();

      const wishlistLink = page.getByRole("link", { name: "Add to wishlist" });
      await expect(wishlistLink).toBeVisible();
      await expect(wishlistLink).toHaveAttribute("href", "/account/login");
      await expect(page.getByRole("button", { name: "Add to wishlist" })).toHaveCount(0);
    } finally {
      await cleanupProduct(productId);
    }
  });
});
