import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
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
// checkout.spec.ts/customer-account.spec.ts's seedProduct (no public
// product-creation flow exists).
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

async function cleanupProduct(productId: string) {
  await withDb(async (client) => {
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

async function signUpCustomer(
  page: Page,
  { name, email, password }: { name: string; email: string; password: string },
) {
  await page.goto("/account/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/account");
}

// Sets the customer's saved mobile + address via the real /account/profile
// form (not a direct DB write), so this spec exercises the same Better Auth
// updateUser round trip the checkout write-back itself uses. The
// area/street/landmark rebuild of the Checkout page left this page and its
// single "Address" field untouched.
async function setInitialProfileAddress(
  page: Page,
  { mobile, address }: { mobile: string; address: string },
) {
  await page.goto("/account/profile");
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByLabel("Address", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated")).toBeVisible();
}

async function addProductToCart(page: Page, productId: string, name: string) {
  await page.goto(`/products/${productId}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
}

// Mirrors checkoutFieldsSchema's toAddress transform (core/src/schemas/
// order.ts) so tests can compute the exact canonical string the server will
// return as order.address, without duplicating the join logic by hand at
// each call site.
function joinAddress({
  area,
  street,
  landmark,
  deliveryNotes,
}: {
  area: string;
  street?: string;
  landmark: string;
  deliveryNotes?: string;
}): string {
  return `${area}${street ? `, ${street}` : ""} — Landmark: ${landmark}${
    deliveryNotes ? `. Notes: ${deliveryNotes}` : ""
  }`;
}

test.describe("Checkout — save address to profile", () => {
  test("prefills name and phone from the signed-in customer's saved profile", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Prefill Product ${unique}`;
    const productId = await seedProduct({ name, price: 50, stock: 5 });
    const email = `e2e-prefill-${unique}@e2e.test`;
    const password = "customer-password-123";
    const customerName = "E2E Prefill Customer";

    try {
      await signUpCustomer(page, { name: customerName, email, password });
      await setInitialProfileAddress(page, {
        mobile: "700555666",
        address: "10 Profile Street",
      });

      await addProductToCart(page, productId, name);

      await page.goto("/checkout");
      await expect(page.getByRole("button", { name: "Delivery" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // Address prefill was deliberately dropped as part of the
      // area/street/landmark rebuild — the new fields have no saved flat
      // address string to split back into. Only name/phone still prefill.
      await expect(page.getByLabel(/Full name/)).toHaveValue(customerName);
      await expect(page.getByLabel(/^Phone \*$/)).toHaveValue("700555666");
      await expect(page.getByLabel(/Area \/ ward/)).toHaveValue("");
      await expect(page.getByLabel(/Nearest landmark/)).toHaveValue("");
    } finally {
      await cleanupProduct(productId);
      await cleanupCustomer(email);
    }
  });

  test("checking 'save to profile' persists the server-computed checkout address after a real order", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `Save Address Product ${unique}`;
    const productId = await seedProduct({ name, price: 80, stock: 5 });
    const email = `e2e-save-address-${unique}@e2e.test`;
    const password = "customer-password-123";
    const customerName = "E2E Save Address Customer";
    const originalAddress = "20 Original Road";
    const checkoutFields = {
      area: "Masaki",
      street: "Haile Selassie Road",
      landmark: "Opposite the yacht club",
      deliveryNotes: "Call on arrival",
    };
    const expectedJoinedAddress = joinAddress(checkoutFields);

    try {
      await signUpCustomer(page, { name: customerName, email, password });
      await setInitialProfileAddress(page, {
        mobile: "700111222",
        address: originalAddress,
      });

      await addProductToCart(page, productId, name);

      await page.goto("/checkout");
      await expect(page.getByRole("button", { name: "Delivery" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await page.getByLabel(/Area \/ ward/).fill(checkoutFields.area);
      await page.getByLabel("Street / building").fill(checkoutFields.street);
      await page.getByLabel(/Nearest landmark/).fill(checkoutFields.landmark);
      await page.getByLabel("Delivery notes").fill(checkoutFields.deliveryNotes);

      await page
        .getByRole("checkbox", { name: "Save this address to my profile" })
        .check();

      // The save-to-profile write-back is a second, best-effort request
      // fired (not awaited) from the order mutation's onSuccess, after the
      // confirmation navigation has already started — wait for the actual
      // update-user response so the DB write is guaranteed to have landed
      // before this test checks for it, rather than racing it.
      const updateUserResponse = page.waitForResponse((res) =>
        res.url().includes("/api/customer-auth/update-user"),
      );
      await page.getByRole("button", { name: /Place order/ }).click();

      await expect(page).toHaveURL("/checkout/confirmation");
      await expect(
        page.getByRole("heading", { name: "Thank you for your order!" }),
      ).toBeVisible();
      await updateUserResponse;

      // Real persistence: reload the profile page and confirm the
      // server-computed joined address (not the original profile address)
      // was written back via the real updateUser -> Prisma round trip.
      await page.goto("/account/profile");
      await expect(page.getByLabel("Address", { exact: true })).toHaveValue(
        expectedJoinedAddress,
      );

      const persisted = await withDb((client) =>
        client.query('SELECT address FROM "customer" WHERE email = $1', [email]),
      );
      expect(persisted.rows[0].address).toBe(expectedJoinedAddress);

      const order = await withDb((client) =>
        client.query(
          `SELECT o.address FROM "order" o
           JOIN "order_item" i ON i."orderId" = o.id
           WHERE i."productId" = $1`,
          [productId],
        ),
      );
      expect(order.rows[0].address).toBe(expectedJoinedAddress);
    } finally {
      await cleanupProduct(productId);
      await cleanupCustomer(email);
    }
  });

  test("leaving 'save to profile' unchecked does not persist the checkout address", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = `No Save Product ${unique}`;
    const productId = await seedProduct({ name, price: 65, stock: 5 });
    const email = `e2e-no-save-${unique}@e2e.test`;
    const password = "customer-password-123";
    const customerName = "E2E No Save Customer";
    const originalAddress = "30 Untouched Street";
    const checkoutFields = {
      area: "Mikocheni",
      landmark: "Near the roundabout",
    };
    const expectedJoinedAddress = joinAddress(checkoutFields);

    try {
      await signUpCustomer(page, { name: customerName, email, password });
      await setInitialProfileAddress(page, {
        mobile: "700333444",
        address: originalAddress,
      });

      await addProductToCart(page, productId, name);

      await page.goto("/checkout");
      await expect(page.getByRole("button", { name: "Delivery" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await page.getByLabel(/Area \/ ward/).fill(checkoutFields.area);
      await page.getByLabel(/Nearest landmark/).fill(checkoutFields.landmark);

      // Leave "Save this address to my profile" unchecked (default state).
      await expect(
        page.getByRole("checkbox", { name: "Save this address to my profile" }),
      ).not.toBeChecked();

      await page.getByRole("button", { name: /Place order/ }).click();

      await expect(page).toHaveURL("/checkout/confirmation");
      await expect(
        page.getByRole("heading", { name: "Thank you for your order!" }),
      ).toBeVisible();

      // The order itself used the submitted address, but the profile was
      // never written back to.
      await page.goto("/account/profile");
      await expect(page.getByLabel("Address", { exact: true })).toHaveValue(originalAddress);

      const persisted = await withDb((client) =>
        client.query('SELECT address FROM "customer" WHERE email = $1', [email]),
      );
      expect(persisted.rows[0].address).toBe(originalAddress);

      const order = await withDb((client) =>
        client.query(
          `SELECT o.address FROM "order" o
           JOIN "order_item" i ON i."orderId" = o.id
           WHERE i."productId" = $1`,
          [productId],
        ),
      );
      expect(order.rows[0].address).toBe(expectedJoinedAddress);
    } finally {
      await cleanupProduct(productId);
      await cleanupCustomer(email);
    }
  });
});
