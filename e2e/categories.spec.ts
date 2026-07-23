import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_DATABASE_URL } from "./test-env";
import { loginAs } from "./helpers";

// Hard-deletes a throwaway category by English name so repeated local/CI runs
// against the shared test DB don't accumulate rows. Mirrors the equivalent
// helper in e2e/products.spec.ts.
async function hardDeleteCategory(name: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    // `name` is a JSON column of localized values; match on the English name.
    await client.query('DELETE FROM "category" WHERE name->>\'en\' = $1', [name]);
  } finally {
    await client.end();
  }
}

test.describe("Create category (ADMIN)", () => {
  test("creating a category via the dialog adds it to the table and persists after reload", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/categories");

    const name = `Created Via UI ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create category" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Create category" })).toBeVisible();

      await dialog.getByLabel("Name").fill(name);
      await dialog.getByRole("button", { name: "Create category" }).click();

      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();

      // Real server persistence, not just optimistic client state.
      await page.reload();
      await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    } finally {
      await hardDeleteCategory(name);
    }
  });
});

test.describe("Edit category (ADMIN)", () => {
  test("editing a category's name updates the table row and persists after reload", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/categories");

    const name = `Editable Category ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const updatedName = `${name} (edited)`;

    try {
      await page.getByRole("button", { name: "Create category" }).click();
      const createDialog = page.getByRole("dialog");
      await createDialog.getByLabel("Name").fill(name);
      await createDialog.getByRole("button", { name: "Create category" }).click();
      await expect(createDialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();

      await row.getByRole("button", { name: `Edit ${name}` }).click();

      const editDialog = page.getByRole("dialog");
      await expect(editDialog.getByRole("heading", { name: "Edit category" })).toBeVisible();
      await expect(editDialog.getByLabel("Name")).toHaveValue(name);

      await editDialog.getByLabel("Name").fill(updatedName);
      await editDialog.getByRole("button", { name: "Save changes" }).click();
      await expect(editDialog).not.toBeVisible();

      const updatedRow = page.getByRole("row").filter({ hasText: updatedName });
      await expect(updatedRow).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: name, hasNotText: "(edited)" })).toHaveCount(0);

      // Confirm the rename actually persisted server-side, not just optimistically.
      await page.reload();
      await expect(page.getByRole("row").filter({ hasText: updatedName })).toBeVisible();
    } finally {
      await hardDeleteCategory(name);
      await hardDeleteCategory(updatedName);
    }
  });
});

test.describe("Delete category (ADMIN)", () => {
  test("deleting a category via the confirmation dialog removes it from the table and it stays gone after reload", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/categories");

    const name = `Deletable Category ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.getByRole("button", { name: "Create category" }).click();
      const createDialog = page.getByRole("dialog");
      await createDialog.getByLabel("Name").fill(name);
      await createDialog.getByRole("button", { name: "Create category" }).click();
      await expect(createDialog).not.toBeVisible();

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
      await hardDeleteCategory(name);
    }
  });
});

test.describe("Duplicate category name (ADMIN)", () => {
  test("creating a category with an English name that already exists shows a conflict error from the server", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/categories");

    const name = `Duplicate Category ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      // Create the original category.
      await page.getByRole("button", { name: "Create category" }).click();
      const firstDialog = page.getByRole("dialog");
      await firstDialog.getByLabel("Name").fill(name);
      await firstDialog.getByRole("button", { name: "Create category" }).click();
      await expect(firstDialog).not.toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();

      // Attempt to create a second category with the same English name.
      await page.getByRole("button", { name: "Create category" }).click();
      const secondDialog = page.getByRole("dialog");
      await secondDialog.getByLabel("Name").fill(name);
      await secondDialog.getByRole("button", { name: "Create category" }).click();

      await expect(
        secondDialog.getByText("A category with this English name already exists"),
      ).toBeVisible();
      await expect(secondDialog).toBeVisible();

      // Only the original row exists — the duplicate was rejected server-side.
      await page.keyboard.press("Escape");
      await expect(secondDialog).not.toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
    } finally {
      await hardDeleteCategory(name);
    }
  });
});
