import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_AGENT_EMAIL,
  TEST_AGENT_NAME,
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
    // `name` is a JSON column of localized values; match on the English name.
    await client.query('DELETE FROM "product" WHERE name->>\'en\' = $1', [name]);
  } finally {
    await client.end();
  }
}

// Creates a throwaway AGENT via the API (as an already-logged-in admin) for
// tests that delete a user, so the shared seeded TEST_AGENT_EMAIL row is
// never touched. Mirrors the helper in e2e/users.spec.ts.
async function createThrowawayAgent(page: Page, label: string) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;
  const name = `Throwaway ${label}`;
  const response = await page.request.post("/api/users", {
    data: { name, email, password: "throwaway-password-123" },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create throwaway agent: ${response.status()}`);
  }
  return { name, email };
}

// Hard-deletes a throwaway user (bypassing the soft-delete API) so repeated
// local/CI runs against the shared test DB don't accumulate rows.
async function hardDeleteUser(email: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM "user" WHERE email = $1', [email]);
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
  await dialog.getByLabel("Stock", { exact: true }).fill(stock);
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: category }).click();
  await dialog.getByLabel("Images").setInputFiles(imagePath);
  await dialog.getByRole("button", { name: "Create product" }).click();

  await expect(dialog).not.toBeVisible();
}

test.describe("Product list (ADMIN)", () => {
  test("admin navigates via the Products nav link and sees the product table", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await page.getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL("/admin/products");

    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Category" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Stock" })).toBeVisible();
  });
});

test.describe("Create product (ADMIN)", () => {
  test("creating a product via the dialog adds it to the table", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const name = `Created Via UI ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Create product" })).toBeVisible();

      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock", { exact: true }).fill("42");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Beverages" }).click();
      await dialog.getByLabel("Images").setInputFiles(SAMPLE_JPEG);

      await dialog.getByRole("button", { name: "Create product" }).click();
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText("Beverages", { exact: true })).toBeVisible();
      await expect(row.getByText("42", { exact: true })).toBeVisible();
      await expect(row.getByLabel("No image")).not.toBeVisible();
      await expect(row.locator("img")).toHaveAttribute("src", /\/api\/uploads\/products\//);
    } finally {
      await hardDeleteProduct(name);
    }
  });
});

test.describe("Edit product (ADMIN)", () => {
  test("editing a product via the Edit dialog updates the table row", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

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
      await expect(dialog.getByLabel("Stock", { exact: true })).toHaveValue("10");

      await dialog.getByLabel("Name").fill(updatedName);
      await dialog.getByLabel("Stock", { exact: true }).fill("99");
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
});

test.describe("Product description (ADMIN)", () => {
  test("creating a product with a description and editing it shows the description pre-filled", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

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
});

test.describe("Delete product (ADMIN)", () => {
  test("deleting a product via the confirmation dialog removes it from the table and it stays gone after reload", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

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
});

test.describe("Product image upload (ADMIN)", () => {
  // Note: hardDeleteProduct only removes the DB row; it doesn't clean up the
  // uploaded file from server/uploads/products/. Left out of scope here since
  // this runs against a local/test-only DB and disk, and stray fixture-sized
  // files don't affect other tests.

  test("uploading a non-image file on the create form shows an error, leaves the dialog open, and doesn't attach an image", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const name = `Photo Invalid Type ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock", { exact: true }).fill("2");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();

      // Bypasses the file input's `accept` filtering, which only applies to
      // the OS file picker, not programmatic setInputFiles — exercises the
      // server's fileFilter rejection.
      await dialog.getByLabel("Images").setInputFiles({
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

  test("uploading a file with a spoofed image mimetype (not real image content) shows an error and doesn't attach an image", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const name = `Photo Spoofed Type ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock", { exact: true }).fill("2");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();

      // Declares a valid image mimetype and a .jpg filename (an attacker
      // spoofing the multipart Content-Type field), but the buffer's actual
      // bytes are plain text, not a real JPEG — exercises the server's
      // magic-byte (file-type) content validation, not just its mimetype
      // fileFilter.
      await dialog.getByLabel("Images").setInputFiles({
        name: "spoofed.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("this is not actually a jpeg, just spoofing the mimetype"),
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
    await page.goto("/admin/products");

    const name = `Photo Too Large ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock", { exact: true }).fill("2");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();

      // A >5MB buffer with a valid image mimeType so the size limit — not the
      // file-type filter — is what triggers the rejection.
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0);
      await dialog.getByLabel("Images").setInputFiles({
        name: "too-big.jpg",
        mimeType: "image/jpeg",
        buffer: oversizedBuffer,
      });

      await dialog.getByRole("button", { name: "Create product" }).click();

      await expect(dialog.getByText("Each image must be 5MB or smaller")).toBeVisible();
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

  test("selecting multiple files at once on the create form persists all of them", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const name = `Multi Image Create ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock", { exact: true }).fill("4");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();

      // Two files selected in a single setInputFiles call, exercising the
      // "multiple" file input rather than one file per selection.
      await dialog.getByLabel("Images").setInputFiles([SAMPLE_JPEG, SAMPLE_PNG]);
      await expect(dialog.getByRole("button", { name: "Remove sample-product.jpg" })).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Remove sample-product-2.png" }),
      ).toBeVisible();

      await dialog.getByRole("button", { name: "Create product" }).click();
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByLabel("No image")).not.toBeVisible();
      await expect(row.locator("img")).toHaveAttribute("src", /\/api\/uploads\/products\//);

      // Confirm both images actually persisted server-side (not just
      // client-side selection state) by opening the edit dialog and counting
      // the resulting gallery thumbnails' remove buttons.
      await row.getByRole("button", { name: `Edit ${name}` }).click();
      const editDialog = page.getByRole("dialog");
      await expect(editDialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(editDialog.getByRole("button", { name: "Remove image" })).toHaveCount(2);
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("adding and removing images via the edit dialog persists across reopening the dialog", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const name = `Edit Gallery Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await createProduct(page, { name, stock: "5", category: "Groceries" });

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      // Wait for the table's own row data to reflect the uploaded image
      // (a second, slightly-delayed list refetch after the image upload)
      // before opening Edit, so the dialog isn't seeded from a stale
      // pre-image snapshot of the product.
      await expect(row.locator("img")).toHaveAttribute("src", /\/api\/uploads\/products\//);
      await row.getByRole("button", { name: `Edit ${name}` }).click();

      let dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Remove image" })).toHaveCount(1);

      // Add another image via the gallery's "Add images" control. The dialog
      // shows the product snapshot as of when it was opened, so — same as
      // the rest of this table's edit flow — reopen it afterward to see the
      // change reflected, rather than expecting it live in the same dialog.
      const uploadResponse = page.waitForResponse(
        (res) => res.url().includes("/images") && res.request().method() === "POST",
      );
      await dialog.getByLabel("Product images").setInputFiles(SAMPLE_JPEG);
      await uploadResponse;
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      const rowAfterAdd = page.getByRole("row").filter({ hasText: name });
      await rowAfterAdd.getByRole("button", { name: `Edit ${name}` }).click();
      dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Remove image" })).toHaveCount(2);

      // Remove one image via the gallery.
      const deleteResponse = page.waitForResponse(
        (res) => res.url().includes("/images/") && res.request().method() === "DELETE",
      );
      await dialog.getByRole("button", { name: "Remove image" }).first().click();
      await deleteResponse;
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();

      // Close and reopen the dialog (and reload the page) to confirm the
      // removal actually persisted server-side (real DB write + disk unlink,
      // not just optimistic client state).
      await page.reload();
      const rowAfterReload = page.getByRole("row").filter({ hasText: name });
      await expect(rowAfterReload).toBeVisible();
      await rowAfterReload.getByRole("button", { name: `Edit ${name}` }).click();

      dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Remove image" })).toHaveCount(1);
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("uploading images beyond the 8-image cap is rejected server-side", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const name = `Image Cap Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      // Create with the client-side max of 8 images already attached.
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Stock", { exact: true }).fill("2");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await dialog.getByLabel("Images").setInputFiles(Array(8).fill(SAMPLE_JPEG));
      await dialog.getByRole("button", { name: "Create product" }).click();
      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.locator("img")).toHaveAttribute("src", /\/api\/uploads\/products\//);
      await row.getByRole("button", { name: `Edit ${name}` }).click();

      const editDialog = page.getByRole("dialog");
      await expect(editDialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(editDialog.getByRole("button", { name: "Remove image" })).toHaveCount(8);
      // The gallery's own "Add images" control is disabled once at the cap.
      await expect(
        editDialog.getByRole("button", { name: "Maximum 8 images" }),
      ).toBeDisabled();

      // Exercise the server's own enforcement directly via the API, since
      // the client control above is disabled and can't be used to attempt it.
      const productsResponse = await page.request.get("/api/products");
      const { products } = await productsResponse.json();
      const product = products.find((p: { name: { en: string } }) => p.name.en === name);
      expect(product).toBeTruthy();

      const response = await page.request.post(`/api/products/${product.id}/images`, {
        multipart: {
          images: {
            name: "one-more.jpg",
            mimeType: "image/jpeg",
            buffer: readFileSync(SAMPLE_JPEG),
          },
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("A product can have at most 8 images");
    } finally {
      await hardDeleteProduct(name);
    }
  });
});

test.describe("Assign agent (ADMIN)", () => {
  test("assigning an agent on create persists and un-assigning on edit persists, both across reload", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const name = `Assignable Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const createDialog = page.getByRole("dialog");
      await createDialog.getByLabel("Name").fill(name);
      await createDialog.getByLabel("Stock", { exact: true }).fill("5");
      await createDialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await createDialog.getByLabel("Assigned agent").click();
      await page.getByRole("option", { name: TEST_AGENT_NAME }).click();
      await createDialog.getByLabel("Images").setInputFiles(SAMPLE_JPEG);
      await createDialog.getByRole("button", { name: "Create product" }).click();
      await expect(createDialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText(TEST_AGENT_NAME, { exact: true })).toBeVisible();

      // Reload and confirm the assignment actually persisted server-side,
      // not just optimistic client state.
      await page.reload();
      const rowAfterReload = page.getByRole("row").filter({ hasText: name });
      await expect(rowAfterReload.getByText(TEST_AGENT_NAME, { exact: true })).toBeVisible();

      await rowAfterReload.getByRole("button", { name: `Edit ${name}` }).click();
      const editDialog = page.getByRole("dialog");
      await expect(editDialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(editDialog.getByLabel("Assigned agent")).toContainText(TEST_AGENT_NAME);

      // Un-assign and confirm it persists as null, not just cleared client-side.
      await editDialog.getByLabel("Assigned agent").click();
      await page.getByRole("option", { name: "Unassigned" }).click();
      await editDialog.getByRole("button", { name: "Save changes" }).click();
      await expect(editDialog).not.toBeVisible();

      const rowAfterUnassign = page.getByRole("row").filter({ hasText: name });
      await expect(rowAfterUnassign.getByText("Unassigned", { exact: true })).toBeVisible();

      await page.reload();
      const rowAfterUnassignReload = page.getByRole("row").filter({ hasText: name });
      await expect(rowAfterUnassignReload.getByText("Unassigned", { exact: true })).toBeVisible();
      await expect(
        rowAfterUnassignReload.getByText(TEST_AGENT_NAME, { exact: true }),
      ).not.toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("assigning a product to a non-agent user via the API is rejected with 404", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    const name = `API Assign Reject ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.goto("/admin/products");
      await createProduct(page, { name, stock: "3", category: "Groceries" });

      const usersResponse = await page.request.get("/api/users");
      expect(usersResponse.ok()).toBe(true);
      const { users } = await usersResponse.json();
      const admin = users.find((u: { email: string }) => u.email === TEST_ADMIN_EMAIL);
      expect(admin).toBeTruthy();

      const productsResponse = await page.request.get("/api/products");
      expect(productsResponse.ok()).toBe(true);
      const { products } = await productsResponse.json();
      const product = products.find((p: { name: { en: string } }) => p.name.en === name);
      expect(product).toBeTruthy();

      // The client's agent dropdown is already filtered to AGENT-role users,
      // so this rejection can only be exercised via a direct API call.
      const putResponse = await page.request.put(`/api/products/${product.id}`, {
        data: {
          name: { en: name },
          price: 0,
          stock: 3,
          lowStockThreshold: 10,
          categoryId: product.category.id,
          assignedAgentId: admin.id,
        },
      });

      expect(putResponse.status()).toBe(404);
      const body = await putResponse.json();
      expect(body.error).toBe("Agent not found");
    } finally {
      await hardDeleteProduct(name);
    }
  });

  test("deleting the assigned agent from the Users page unassigns their products", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const { name: agentName, email: agentEmail } = await createThrowawayAgent(
      page,
      "unassign-on-delete",
    );

    const name = `Agent Delete Cascade Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.goto("/admin/products");
      await page.getByRole("button", { name: "Create product" }).click();
      const createDialog = page.getByRole("dialog");
      await createDialog.getByLabel("Name").fill(name);
      await createDialog.getByLabel("Stock", { exact: true }).fill("5");
      await createDialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await createDialog.getByLabel("Assigned agent").click();
      await page.getByRole("option", { name: agentName }).click();
      await createDialog.getByLabel("Images").setInputFiles(SAMPLE_JPEG);
      await createDialog.getByRole("button", { name: "Create product" }).click();
      await expect(createDialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText(agentName, { exact: true })).toBeVisible();

      // Soft-delete the agent from the admin Users page, which per the
      // DELETE /api/users/:id route also unassigns any products currently
      // assigned to them, in the same transaction as the soft-delete.
      await page.goto("/admin/users");
      const userRow = page.getByRole("row").filter({ hasText: agentEmail });
      await expect(userRow).toBeVisible();
      await userRow.getByRole("button", { name: `Delete ${agentName}` }).click();
      const deleteDialog = page.getByRole("alertdialog");
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole("button", { name: "Delete" }).click();
      await expect(deleteDialog).not.toBeVisible();
      await expect(userRow).not.toBeVisible();

      // The product now shows as Unassigned rather than referencing the
      // deleted agent — check both the immediately-invalidated list and a
      // fresh reload to confirm the FK change actually persisted server-side.
      await page.goto("/admin/products");
      const rowAfterAgentDelete = page.getByRole("row").filter({ hasText: name });
      await expect(rowAfterAgentDelete.getByText("Unassigned", { exact: true })).toBeVisible();
      await expect(
        rowAfterAgentDelete.getByText(agentName, { exact: true }),
      ).not.toBeVisible();

      await page.reload();
      const rowAfterReload = page.getByRole("row").filter({ hasText: name });
      await expect(rowAfterReload.getByText("Unassigned", { exact: true })).toBeVisible();

      await rowAfterReload.getByRole("button", { name: `Edit ${name}` }).click();
      const editDialog = page.getByRole("dialog");
      await expect(editDialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(editDialog.getByLabel("Assigned agent")).toContainText("Unassigned");
    } finally {
      await hardDeleteProduct(name);
      await hardDeleteUser(agentEmail);
    }
  });
});

test.describe("Sale price", () => {
  test("setting a sale price in admin persists and shows the discount on the storefront", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const name = `On Sale Product ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create product" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Price", { exact: true }).fill("100");
      await dialog.getByLabel("Sale price (optional)").fill("75");
      await dialog.getByLabel("Stock", { exact: true }).fill("10");
      await dialog.getByLabel("Category").click();
      await page.getByRole("option", { name: "Groceries" }).click();
      await dialog.getByLabel("Images").setInputFiles(SAMPLE_JPEG);
      await dialog.getByRole("button", { name: "Create product" }).click();
      await expect(dialog).not.toBeVisible();

      // Admin table: "Sale" badge + struck-through original price + sale price.
      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await expect(row.getByText("Sale", { exact: true })).toBeVisible();
      await expect(row.getByText("100", { exact: true })).toBeVisible();
      await expect(row.getByText("75", { exact: true })).toBeVisible();

      // Reload to confirm the sale price actually persisted server-side, not
      // just optimistic client state, then reopen the edit dialog to confirm
      // it's pre-filled from the real DB row.
      await page.reload();
      const rowAfterReload = page.getByRole("row").filter({ hasText: name });
      await expect(rowAfterReload.getByText("Sale", { exact: true })).toBeVisible();
      await rowAfterReload.getByRole("button", { name: `Edit ${name}` }).click();
      const editDialog = page.getByRole("dialog");
      await expect(editDialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
      await expect(editDialog.getByLabel("Sale price (optional)")).toHaveValue("75");
      await page.keyboard.press("Escape");
      await expect(editDialog).not.toBeVisible();

      // Storefront (unauthenticated): find the product via search, confirm the
      // "−25%" badge and discounted/struck-through price both render, using a
      // real, unauthenticated query against the same DB row. The search term
      // is unique to this throwaway product, so the grid narrows to just it.
      await page.context().clearCookies();
      await page.goto("/products");
      await page.getByLabel("Search", { exact: true }).fill(name);

      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
      await expect(page.getByText("−25%", { exact: true })).toBeVisible();
      await expect(page.getByText("75", { exact: true })).toBeVisible();
      await expect(page.getByText("100", { exact: true })).toBeVisible();

      // Filtering by the "On sale" availability option still shows the product.
      await page.getByLabel("Availability", { exact: true }).click();
      await page.getByRole("option", { name: "On sale" }).click();
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    } finally {
      await hardDeleteProduct(name);
    }
  });
});

test.describe("Product list access control", () => {
  test("AGENT visiting /admin/products is redirected home and sees no Products nav link", async ({
    page,
  }) => {
    await loginAs(page, TEST_AGENT_EMAIL, TEST_AGENT_PASSWORD);

    await expect(page.getByRole("link", { name: "Products" })).not.toBeVisible();

    await page.goto("/admin/products");
    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("columnheader", { name: "Stock" })).not.toBeVisible();
  });

  test("unauthenticated visit to /admin/products redirects to /admin/login", async ({ page }) => {
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
