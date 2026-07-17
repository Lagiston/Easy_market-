import { expect, test } from "@playwright/test";
import { Client } from "pg";
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_AGENT_EMAIL,
  TEST_AGENT_PASSWORD,
  TEST_DATABASE_URL,
} from "./test-env";
import { loginAs } from "./helpers";

// Hard-deletes a throwaway product by name so repeated local/CI runs against
// the shared test DB don't accumulate rows.
async function hardDeleteProduct(name: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM "product" WHERE name = $1', [name]);
  } finally {
    await client.end();
  }
}

test.describe("Product list (ADMIN)", () => {
  test("admin navigates via the Products nav link and sees the product table", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await page.getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL("/products");

    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Category" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Stock" })).toBeVisible();
  });
});

test.describe("Create product (ADMIN)", () => {
  test("creating a product via the dialog adds it to the table", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Created Via UI ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Create product" })).toBeVisible();

      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock").fill("42");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Beverages" }).click();

      await dialog.getByRole("button", { name: "Create product" }).click();

      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText("Beverages", { exact: true })).toBeVisible();
      await expect(row.getByText("42", { exact: true })).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("submitting with an empty name shows a validation error and creates no product", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    let createRequestSent = false;
    await page.route("**/api/products", (route) => {
      if (route.request().method() === "POST") createRequestSent = true;
      return route.continue();
    });

    await page.getByRole("button", { name: "Create product" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create product" })).toBeVisible();

    await dialog.getByLabel("Stock").fill("5");
    await dialog.getByLabel("Category").click();
    await page.getByRole("option", { name: "Groceries" }).click();

    await dialog.getByRole("button", { name: "Create product" }).click();

    await expect(dialog.getByText("Name must be at least 2 characters")).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(createRequestSent).toBe(false);
  });
});

test.describe("Product list access control", () => {
  test("AGENT visiting /products is redirected home and sees no Products nav link", async ({
    page,
  }) => {
    await loginAs(page, TEST_AGENT_EMAIL, TEST_AGENT_PASSWORD);

    await expect(page.getByRole("link", { name: "Products" })).not.toBeVisible();

    await page.goto("/products");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("columnheader", { name: "Stock" })).not.toBeVisible();
  });

  test("unauthenticated visit to /products redirects to /login", async ({ page }) => {
    await page.goto("/products");
    await expect(page).toHaveURL(/\/login$/);
  });
});
