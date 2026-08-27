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

test.describe("Product reviews", () => {
  test("signed-in customer with a real order leaves a verified review that persists, edits, and deletes", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Review Product ${unique}`;
    const price = 45;
    const productId = await seedProduct({ name, price, stock: 5 });
    const email = `e2e-reviewer-${unique}@e2e.test`;
    const password = "reviewer-password-123";
    const customerName = "E2E Reviewer";

    try {
      // Sign up as a brand-new customer.
      await page.goto("/account/signup");
      await page.getByLabel("Name").fill(customerName);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign up" }).click();
      await expect(page).toHaveURL("/account");

      // Place a pickup order for the product while signed in, so
      // verifiedPurchase has a real non-cancelled order to compute from.
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await page.getByRole("button", { name: "Add to cart" }).click();

      await page.goto("/checkout");
      await page.getByLabel(/Full name/).fill(customerName);
      await page.getByLabel(/^Phone \*$/).fill("700555666");
      await page.getByRole("button", { name: "Store pickup" }).click();
      await page.getByRole("button", { name: /Place order/ }).click();
      await expect(page).toHaveURL("/checkout/confirmation");
      await expect(
        page.getByRole("heading", { name: "Thank you for your order!" }),
      ).toBeVisible();

      // Submit a review for that same product on its detail page.
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      const comment = `Great product! ${unique}`;
      const headline = `Terrific find ${unique}`;
      await page.getByRole("button", { name: "Rate 4 stars" }).click();
      await page.getByLabel("Headline (optional)").fill(headline);
      await page.getByLabel("Comment (optional)").fill(comment);
      await page.getByRole("button", { name: "Submit review" }).click();

      const reviewItem = page.getByText(comment).locator("..");
      await expect(reviewItem.getByText("Verified purchase")).toBeVisible();
      await expect(reviewItem.getByText(customerName)).toBeVisible();
      await expect(reviewItem.getByText(headline)).toBeVisible();

      // Real persistence: reload and the review (with badge + headline) is still there.
      await page.reload();
      const reloadedReviewItem = page.getByText(comment).locator("..");
      await expect(reloadedReviewItem.getByText("Verified purchase")).toBeVisible();
      await expect(reloadedReviewItem.getByText(customerName)).toBeVisible();
      await expect(reloadedReviewItem.getByText(headline)).toBeVisible();

      // Real DB check that verifiedPurchase was computed server-side, and the headline saved.
      const persistedReview = await withDb((client) =>
        client.query(
          `SELECT r."verifiedPurchase", r."customerId", r.headline, c.email
           FROM "review" r
           JOIN "customer" c ON c.id = r."customerId"
           WHERE r."productId" = $1 AND r.comment = $2`,
          [productId, comment],
        ),
      );
      expect(persistedReview.rows).toHaveLength(1);
      expect(persistedReview.rows[0].verifiedPurchase).toBe(true);
      expect(persistedReview.rows[0].email).toBe(email);
      expect(persistedReview.rows[0].headline).toBe(headline);

      // Edit the review inline: change rating, comment, and headline.
      const editedComment = `Updated review ${unique}`;
      const editedHeadline = `Even better than I thought ${unique}`;
      await page.getByRole("button", { name: "Edit your review" }).click();
      const editForm = page.locator("form").filter({ hasText: "Save changes" });
      await editForm.getByRole("button", { name: "Rate 2 stars" }).click();
      await editForm.getByLabel("Headline (optional)").fill(editedHeadline);
      await editForm.getByLabel("Comment (optional)").fill(editedComment);
      await editForm.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText(editedComment)).toBeVisible();
      await expect(page.getByText(comment, { exact: true })).toHaveCount(0);
      await expect(page.getByText(editedHeadline)).toBeVisible();
      await expect(page.getByText(headline, { exact: true })).toHaveCount(0);

      // Persistence across reload after edit.
      await page.reload();
      await expect(page.getByText(editedComment)).toBeVisible();
      const editedReviewItem = page.getByText(editedComment).locator("..");
      await expect(editedReviewItem.getByText("Verified purchase")).toBeVisible();
      await expect(editedReviewItem.getByText(editedHeadline)).toBeVisible();

      const persistedEdit = await withDb((client) =>
        client.query(
          'SELECT rating, comment, headline FROM "review" WHERE "productId" = $1',
          [productId],
        ),
      );
      expect(persistedEdit.rows).toHaveLength(1);
      expect(persistedEdit.rows[0].rating).toBe(2);
      expect(persistedEdit.rows[0].comment).toBe(editedComment);
      expect(persistedEdit.rows[0].headline).toBe(editedHeadline);

      // Delete via the confirmation dialog.
      await page.getByRole("button", { name: "Delete your review" }).click();
      await expect(page.getByRole("heading", { name: "Delete your review?" })).toBeVisible();
      await page.getByRole("button", { name: "Delete", exact: true }).click();

      await expect(page.getByText(editedComment)).toHaveCount(0);
      await expect(page.getByText("No reviews yet").first()).toBeVisible();

      // Reload confirms the delete really persisted, not just client state.
      await page.reload();
      await expect(page.getByText("No reviews yet").first()).toBeVisible();

      const persistedDelete = await withDb((client) =>
        client.query('SELECT id FROM "review" WHERE "productId" = $1', [productId]),
      );
      expect(persistedDelete.rows).toHaveLength(0);
    } finally {
      await cleanupProduct(productId);
      await cleanupCustomer(email);
    }
  });

  test("a guest can submit a review with no verified-purchase badge", async ({ page }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Guest Review Product ${unique}`;
    const productId = await seedProduct({ name, price: 30, stock: 5 });

    try {
      await page.goto(`/products/${productId}`);
      await expect(page.getByRole("heading", { name })).toBeVisible();

      // No signed-in session: header shows the signed-out affordance.
      await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

      const comment = `Guest review ${unique}`;
      await page.getByLabel("Name").fill("E2E Guest Reviewer");
      await page.getByRole("button", { name: "Rate 5 stars" }).click();
      await page.getByLabel("Comment (optional)").fill(comment);
      await page.getByRole("button", { name: "Submit review" }).click();

      const reviewItem = page.getByText(comment).locator("..");
      await expect(reviewItem.getByText("E2E Guest Reviewer")).toBeVisible();
      await expect(page.getByText("Verified purchase")).toHaveCount(0);

      const persisted = await withDb((client) =>
        client.query(
          'SELECT "customerId", "verifiedPurchase" FROM "review" WHERE "productId" = $1',
          [productId],
        ),
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0].customerId).toBeNull();
      expect(persisted.rows[0].verifiedPurchase).toBe(false);
    } finally {
      await cleanupProduct(productId);
    }
  });
});
