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

// Fills and submits the (single-step) create-product form, attaching the given
// image file since it's now required to submit at all. Returns once the
// dialog has closed.
async function createProduct(
  page: import("@playwright/test").Page,
  {
    name,
    stock,
    category,
    imagePath = SAMPLE_JPEG,
    description,
  }: {
    name: string;
    stock: string;
    category: string;
    imagePath?: string;
    description?: string;
  },
) {
  await page.getByRole("button", { name: "Create product" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  if (description !== undefined) {
    await dialog.getByLabel("Description").fill(description);
  }
  await dialog.getByLabel("Stock").fill(stock);
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: category }).click();
  await dialog.getByLabel("Image").setInputFiles(imagePath);
  await dialog.getByRole("button", { name: "Create product" }).click();

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
      await dialog.getByLabel("Image").setInputFiles(SAMPLE_JPEG);

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
    await dialog.getByLabel("Image").setInputFiles(SAMPLE_JPEG);

    await dialog.getByRole("button", { name: "Create product" }).click();

    await expect(dialog.getByText("Name must be at least 2 characters")).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(createRequestSent).toBe(false);
  });

  test("submitting without selecting an image shows a validation error and creates no product", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    let createRequestSent = false;
    await page.route("**/api/products", (route) => {
      if (route.request().method() === "POST") createRequestSent = true;
      return route.continue();
    });

    const name = `No Image Selected ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await page.getByRole("button", { name: "Create product" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create product" })).toBeVisible();

    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Stock").fill("5");
    await dialog.getByLabel("Category").click();
    await page.getByRole("option", { name: "Groceries" }).click();

    await dialog.getByRole("button", { name: "Create product" }).click();

    await expect(dialog.getByText("An image is required")).toBeVisible();
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
      await createProduct(page, { name, stock: "10", category: "Groceries" });

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
      await createProduct(page, { name, stock: "5", category: "Groceries" });

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

test.describe("Product description (ADMIN)", () => {
  test("creating a product with a description and editing it shows the description pre-filled", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Described Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const description = "A rich, aromatic blend sourced from local growers.";

    try {
      await createProduct(page, { name, stock: "6", category: "Groceries", description });

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();

      await row.getByRole("button", { name: `Edit ${name}` }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(dialog.getByLabel("Description")).toHaveValue(description);
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("creating a product with the description left blank succeeds", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Blank Description ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await createProduct(page, { name, stock: "6", category: "Groceries" });

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("a description longer than 1000 characters shows a validation error and creates no product", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    let createRequestSent = false;
    await page.route("**/api/products", (route) => {
      if (route.request().method() === "POST") createRequestSent = true;
      return route.continue();
    });

    const name = `Description Too Long ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Uses spaces so the textarea wraps normally instead of rendering as one
    // unbroken line.
    const longDescription = "lorem ipsum ".repeat(90);

    try {
      await page.getByRole("button", { name: "Create product" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Create product" })).toBeVisible();

      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Description").fill(longDescription);
      await dialog.getByLabel("Stock").fill("6");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await dialog.getByLabel("Image").setInputFiles(SAMPLE_JPEG);

      await dialog.getByRole("button", { name: "Create product" }).click();

      await expect(
        dialog.getByText("Description must be 1000 characters or fewer"),
      ).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(createRequestSent).toBe(false);
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
      await createProduct(page, { name, stock: "7", category: "Groceries" });

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
      await createProduct(page, { name, stock: "3", category: "Groceries" });

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

  test("creating a product with an image shows the thumbnail in the table", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Photo On Create ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await createProduct(page, {
        name,
        stock: "15",
        category: "Groceries",
        imagePath: SAMPLE_JPEG,
      });

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
      // Create the product with an initial image via the (single-step) create flow.
      await createProduct(page, {
        name,
        stock: "8",
        category: "Groceries",
        imagePath: SAMPLE_JPEG,
      });

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      const initialSrc = await row.locator("img").getAttribute("src");
      expect(initialSrc).toMatch(/\/api\/uploads\/products\//);

      // Replace the image from the Edit dialog.
      await row.getByRole("button", { name: `Edit ${name}` }).click();
      const dialog = page.getByRole("dialog");
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

  test("uploading a non-image file on the create form shows an error, leaves the dialog open, and doesn't attach an image", async ({
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

      // Bypasses the file input's `accept` filtering, which only applies to
      // the OS file picker, not programmatic setInputFiles — exercises the
      // server's fileFilter rejection.
      await dialog.getByLabel("Image").setInputFiles({
        name: "not-an-image.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("this is not an image"),
      });

      await dialog.getByRole("button", { name: "Create product" }).click();

      await expect(
        dialog.getByText("Image must be a JPEG, PNG, or WebP file"),
      ).toBeVisible();
      await expect(dialog).toBeVisible();

      // The client already POSTed the product itself before the image upload
      // failed, so the row exists server-side without an image. The product
      // list is invalidated as soon as the product is created (independent of
      // whether the image upload succeeds), so it shows up in the table right
      // away — no reload needed — once the dialog is closed and the table is
      // no longer hidden behind the modal.
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByLabel("No image")).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("uploading an oversized image on the create form shows a size error and leaves the dialog open", async ({
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

      // A >5MB buffer with a valid image mimeType so the size limit — not the
      // file-type filter — is what triggers the rejection.
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0);
      await dialog.getByLabel("Image").setInputFiles({
        name: "too-big.jpg",
        mimeType: "image/jpeg",
        buffer: oversizedBuffer,
      });

      await dialog.getByRole("button", { name: "Create product" }).click();

      await expect(dialog.getByText("Image must be 5MB or smaller")).toBeVisible();
      await expect(dialog).toBeVisible();

      // Row is created server-side despite the failed upload and shows up as
      // soon as the dialog closes, without needing a reload.
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByLabel("No image")).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("uploading a non-image file on the Edit dialog's image control shows an error and leaves the existing image intact", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/products");

    const name = `Photo Edit Invalid ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await createProduct(page, {
        name,
        stock: "4",
        category: "Groceries",
        imagePath: SAMPLE_JPEG,
      });

      const row = page.getByRole("row").filter({ hasText: name });
      const initialSrc = await row.locator("img").getAttribute("src");
      expect(initialSrc).toMatch(/\/api\/uploads\/products\//);

      await row.getByRole("button", { name: `Edit ${name}` }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();

      await dialog.getByLabel("Product image").setInputFiles({
        name: "not-an-image.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("this is not an image"),
      });

      await expect(
        dialog.getByText("Image must be a JPEG, PNG, or WebP file"),
      ).toBeVisible();
      await expect(dialog).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      await expect(row.locator("img")).toHaveAttribute("src", initialSrc!);
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
