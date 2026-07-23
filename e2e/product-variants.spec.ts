import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_DATABASE_URL } from "./test-env";
import { loginAs } from "./helpers";

const SAMPLE_JPEG = path.join(import.meta.dirname, "fixtures/sample-product.jpg");

// Hard-deletes a throwaway product by name so repeated local/CI runs against
// the shared test DB don't accumulate rows. Mirrors the helper in
// e2e/products.spec.ts.
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

// Fills and submits the (single-step) create-product form, attaching the given
// image file since it's now required to submit at all. Returns once the
// dialog has closed. Mirrors the helper in e2e/products.spec.ts.
async function createProduct(
  page: Page,
  { name, stock, category }: { name: string; stock: string; category: string },
) {
  await page.getByRole("button", { name: "Create product" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Stock", { exact: true }).fill(stock);
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: category }).click();
  await dialog.getByLabel("Images").setInputFiles(SAMPLE_JPEG);
  await dialog.getByRole("button", { name: "Create product" }).click();

  await expect(dialog).not.toBeVisible();
}

// Looks up a product's id via the admin list endpoint by its (unique) English
// name — the storefront routes we navigate to below need the id, not the name.
async function getProductId(page: Page, name: string): Promise<string> {
  const response = await page.request.get("/api/products", {
    params: { search: name, page: 1 },
  });
  expect(response.ok()).toBe(true);
  const { products } = await response.json();
  const product = products.find((p: { id: string; name: { en: string } }) => p.name.en === name);
  expect(product).toBeTruthy();
  return product.id;
}

// Opens the edit dialog for the row with the given name and returns the
// dialog locator, positioned for further interaction with ProductVariantLinks.
async function openEditDialog(page: Page, name: string) {
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `Edit ${name}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit product" })).toBeVisible();
  return dialog;
}

// Searches for `candidateName` in the ProductVariantLinks search box and
// clicks the matching candidate row to link it in.
async function linkVariant(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
  candidateName: string,
) {
  await dialog.getByLabel("Search products to link as a variant").fill(candidateName);
  const candidateButton = dialog.getByRole("button", { name: candidateName });
  await expect(candidateButton).toBeVisible();
  await candidateButton.click();
  await expect(dialog.getByRole("button", { name: `Remove ${candidateName}` })).toBeVisible();
}

test.describe("Product variant linking (ADMIN)", () => {
  test("linking two products cross-links them on the storefront, and unlinking removes the cross-link", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const nameA = `Variant Product A ${suffix}`;
    const nameB = `Variant Product B ${suffix}`;

    try {
      await createProduct(page, { name: nameA, stock: "5", category: "Groceries" });
      await createProduct(page, { name: nameB, stock: "5", category: "Groceries" });

      const idA = await getProductId(page, nameA);
      const idB = await getProductId(page, nameB);

      // Sanity check: before linking, neither product's storefront page shows
      // a related-products section at all.
      await page.goto(`/products/${idA}`);
      await expect(page.getByRole("heading", { name: "Related products" })).not.toBeVisible();

      // Link B into A's variant group via the admin edit dialog.
      await page.goto("/admin/products");
      const dialogA = await openEditDialog(page, nameA);
      await linkVariant(page, dialogA, nameB);
      await page.keyboard.press("Escape");
      await expect(dialogA).not.toBeVisible();

      // A's storefront page shows B as a related product...
      await page.goto(`/products/${idA}`);
      await expect(page.getByRole("heading", { name: "Related products" })).toBeVisible();
      const relatedOnA = page.getByRole("link", { name: new RegExp(nameB) });
      await expect(relatedOnA).toBeVisible();
      await expect(relatedOnA).toHaveAttribute("href", `/products/${idB}`);

      // ...and, since the group token is shared, B's storefront page shows A
      // too (mutual cross-linking, the actual point of the feature).
      await page.goto(`/products/${idB}`);
      await expect(page.getByRole("heading", { name: "Related products" })).toBeVisible();
      const relatedOnB = page.getByRole("link", { name: new RegExp(nameA) });
      await expect(relatedOnB).toBeVisible();
      await expect(relatedOnB).toHaveAttribute("href", `/products/${idA}`);

      // Now unlink B from A via the edit dialog.
      await page.goto("/admin/products");
      const dialogAAgain = await openEditDialog(page, nameA);
      await dialogAAgain.getByRole("button", { name: `Remove ${nameB}` }).click();
      await expect(
        dialogAAgain.getByRole("button", { name: `Remove ${nameB}` }),
      ).not.toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialogAAgain).not.toBeVisible();

      // With only one member left, the group is fully dissolved — neither
      // product's storefront page shows a related-products section anymore.
      await page.goto(`/products/${idA}`);
      await expect(page.getByRole("heading", { name: "Related products" })).not.toBeVisible();
      await expect(page.getByRole("link", { name: new RegExp(nameB) })).not.toBeVisible();

      await page.goto(`/products/${idB}`);
      await expect(page.getByRole("heading", { name: "Related products" })).not.toBeVisible();
      await expect(page.getByRole("link", { name: new RegExp(nameA) })).not.toBeVisible();
    } finally {
      await hardDeleteProduct(nameA);
      await hardDeleteProduct(nameB);
    }
  });

  test("linking a third product into an existing variant group shows all siblings on every member's storefront page", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/products");

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const nameA = `Variant Trio A ${suffix}`;
    const nameB = `Variant Trio B ${suffix}`;
    const nameC = `Variant Trio C ${suffix}`;

    try {
      await createProduct(page, { name: nameA, stock: "5", category: "Groceries" });
      await createProduct(page, { name: nameB, stock: "5", category: "Groceries" });
      await createProduct(page, { name: nameC, stock: "5", category: "Groceries" });

      const idA = await getProductId(page, nameA);
      const idB = await getProductId(page, nameB);
      const idC = await getProductId(page, nameC);

      // Link B, then C, both into A's group.
      const dialogA = await openEditDialog(page, nameA);
      await linkVariant(page, dialogA, nameB);
      await linkVariant(page, dialogA, nameC);
      await page.keyboard.press("Escape");
      await expect(dialogA).not.toBeVisible();

      // Each of the three products' storefront pages shows the other two.
      await page.goto(`/products/${idA}`);
      await expect(page.getByRole("link", { name: new RegExp(nameB) })).toHaveAttribute(
        "href",
        `/products/${idB}`,
      );
      await expect(page.getByRole("link", { name: new RegExp(nameC) })).toHaveAttribute(
        "href",
        `/products/${idC}`,
      );

      await page.goto(`/products/${idB}`);
      await expect(page.getByRole("link", { name: new RegExp(nameA) })).toHaveAttribute(
        "href",
        `/products/${idA}`,
      );
      await expect(page.getByRole("link", { name: new RegExp(nameC) })).toHaveAttribute(
        "href",
        `/products/${idC}`,
      );

      await page.goto(`/products/${idC}`);
      await expect(page.getByRole("link", { name: new RegExp(nameA) })).toHaveAttribute(
        "href",
        `/products/${idA}`,
      );
      await expect(page.getByRole("link", { name: new RegExp(nameB) })).toHaveAttribute(
        "href",
        `/products/${idB}`,
      );
    } finally {
      await hardDeleteProduct(nameA);
      await hardDeleteProduct(nameB);
      await hardDeleteProduct(nameC);
    }
  });
});
