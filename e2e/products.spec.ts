import path from "node:path";
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

const SAMPLE_JPEG = path.join(import.meta.dirname, "fixtures/sample-product.jpg");
const SAMPLE_PNG = path.join(import.meta.dirname, "fixtures/sample-product-2.png");

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

// Fills and submits the create-product form, then dismisses the required
// "Add a photo" step (via Escape) since most tests aren't about photos.
// Returns the (now closed) dialog locator for callers that don't need it.
async function createProductAndSkipPhoto(
  page: import("@playwright/test").Page,
  { name, stock, category }: { name: string; stock: string; category: string },
) {
  await page.getByRole("button", { name: "Create product" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Stock").fill(stock);
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: category }).click();
  await dialog.getByRole("button", { name: "Create product" }).click();

  await expect(dialog.getByRole("heading", { name: "Add a photo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
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

      // Creating switches the dialog to the required "Add a photo" step
      // rather than closing it; dismiss it since this test isn't about photos.
      await expect(dialog.getByRole("heading", { name: "Add a photo" })).toBeVisible();
      await page.keyboard.press("Escape");
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

test.describe("Edit product (ADMIN)", () => {
  test("editing a product via the Edit dialog updates the table row", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Editable Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const updatedName = `${name} (edited)`;

    try {
      // Create a throwaway product to edit.
      await createProductAndSkipPhoto(page, { name, stock: "10", category: "Groceries" });

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();

      await row.getByRole("button", { name: `Edit ${name}` }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(dialog.getByLabel("Name")).toHaveValue(name);
      await expect(dialog.getByLabel("Stock")).toHaveValue("10");

      await dialog.getByLabel("Name").fill(updatedName);
      await dialog.getByLabel("Stock").fill("99");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Beverages" }).click();

      await dialog.getByRole("button", { name: "Save changes" }).click();
      await expect(dialog).not.toBeVisible();

      const updatedRow = page.getByRole("row").filter({ hasText: updatedName });
      await expect(updatedRow).toBeVisible();
      await expect(updatedRow.getByText("Beverages", { exact: true })).toBeVisible();
      await expect(updatedRow.getByText("99", { exact: true })).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
      await hardDeleteProduct(updatedName);
    }
  });

  test("submitting the edit form with an empty name shows a validation error and leaves the row unchanged", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Edit Validation ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await createProductAndSkipPhoto(page, { name, stock: "5", category: "Groceries" });

      const row = page.getByRole("row").filter({ hasText: name });
      await row.getByRole("button", { name: `Edit ${name}` }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();

      let putRequestSent = false;
      await page.route("**/api/products/*", (route) => {
        if (route.request().method() === "PUT") putRequestSent = true;
        return route.continue();
      });

      await dialog.getByLabel("Name").fill("");
      await dialog.getByRole("button", { name: "Save changes" }).click();

      await expect(dialog.getByText("Name must be at least 2 characters")).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(putRequestSent).toBe(false);

      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });
});

test.describe("Delete product (ADMIN)", () => {
  test("deleting a product via the confirmation dialog removes it from the table and it stays gone after reload", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Deletable Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await createProductAndSkipPhoto(page, { name, stock: "7", category: "Groceries" });

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();

      await row.getByRole("button", { name: `Delete ${name}` }).click();

      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog.getByRole("heading", { name: `Delete ${name}?` })).toBeVisible();

      await alertDialog.getByRole("button", { name: "Delete" }).click();
      await expect(alertDialog).not.toBeVisible();

      await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);

      await page.reload();
      await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("cancelling the delete confirmation keeps the product in the table", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Delete Cancel ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await createProductAndSkipPhoto(page, { name, stock: "3", category: "Groceries" });

      const row = page.getByRole("row").filter({ hasText: name });
      await row.getByRole("button", { name: `Delete ${name}` }).click();

      const alertDialog = page.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible();
      await alertDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(alertDialog).not.toBeVisible();

      await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });
});

test.describe("Product image upload (ADMIN)", () => {
  // Note: hardDeleteProduct only removes the DB row; it doesn't clean up the
  // uploaded file from server/uploads/products/. Left out of scope here since
  // this runs against a local/test-only DB and disk, and stray fixture-sized
  // files don't affect other tests.

  test("uploading an image in the required 'Add a photo' step closes the dialog and shows the thumbnail", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Photo On Create ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock").fill("15");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await dialog.getByRole("button", { name: "Create product" }).click();

      await expect(dialog.getByRole("heading", { name: "Add a photo" })).toBeVisible();
      await expect(dialog.getByText(`Add a photo to finish setting up ${name}.`)).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Upload image" })).toBeVisible();

      await dialog.getByLabel("Product image").setInputFiles(SAMPLE_JPEG);

      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByLabel("No image")).not.toBeVisible();
      await expect(row.locator("img")).toHaveAttribute("src", /\/api\/uploads\/products\//);
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("replacing an existing product's image from the Edit dialog updates the table thumbnail", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Photo On Edit ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      // Create the product and set its initial image via the create flow.
      await page.getByRole("button", { name: "Create product" }).click();
      let dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock").fill("8");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await dialog.getByRole("button", { name: "Create product" }).click();
      await expect(dialog.getByRole("heading", { name: "Add a photo" })).toBeVisible();
      await dialog.getByLabel("Product image").setInputFiles(SAMPLE_JPEG);
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      const initialSrc = await row.locator("img").getAttribute("src");
      expect(initialSrc).toMatch(/\/api\/uploads\/products\//);

      // Replace the image from the Edit dialog.
      await row.getByRole("button", { name: `Edit ${name}` }).click();
      dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Change image" })).toBeVisible();

      await dialog.getByLabel("Product image").setInputFiles(SAMPLE_PNG);
      await expect(dialog.getByText("Uploading…")).not.toBeVisible();

      // Editing the image doesn't gate/close the dialog; close it explicitly.
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      await expect(row.locator("img")).toHaveAttribute("src", /\/api\/uploads\/products\//);
      const updatedSrc = await row.locator("img").getAttribute("src");
      expect(updatedSrc).not.toBe(initialSrc);
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("uploading a non-image file shows an error and leaves the dialog open", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Photo Invalid Type ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock").fill("2");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await dialog.getByRole("button", { name: "Create product" }).click();
      await expect(dialog.getByRole("heading", { name: "Add a photo" })).toBeVisible();

      // Bypasses the file input's `accept` filtering, which only applies to
      // the OS file picker, not programmatic setInputFiles — exercises the
      // server's fileFilter rejection.
      await dialog.getByLabel("Product image").setInputFiles({
        name: "not-an-image.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("this is not an image"),
      });

      await expect(
        dialog.getByText("Image must be a JPEG, PNG, or WebP file"),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Add a photo" })).toBeVisible();

      // Close the dialog to check the table row (background content is
      // rendered inert/aria-hidden while the modal dialog is open).
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row.getByLabel("No image")).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("uploading an oversized image shows a size error and leaves the dialog open", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Photo Too Large ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock").fill("2");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await dialog.getByRole("button", { name: "Create product" }).click();
      await expect(dialog.getByRole("heading", { name: "Add a photo" })).toBeVisible();

      // A >5MB buffer with a valid image mimeType so the size limit — not the
      // file-type filter — is what triggers the rejection.
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0);
      await dialog.getByLabel("Product image").setInputFiles({
        name: "too-big.jpg",
        mimeType: "image/jpeg",
        buffer: oversizedBuffer,
      });

      await expect(dialog.getByText("Image must be 5MB or smaller")).toBeVisible();
      await expect(dialog).toBeVisible();

      // Close the dialog to check the table row (background content is
      // rendered inert/aria-hidden while the modal dialog is open).
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row.getByLabel("No image")).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("dismissing the required photo step via Escape leaves the product without an image", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Photo Skipped ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock").fill("1");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await dialog.getByRole("button", { name: "Create product" }).click();
      await expect(dialog.getByRole("heading", { name: "Add a photo" })).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByLabel("No image")).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
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
