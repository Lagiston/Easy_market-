import path from "node:path";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./test-env";

const SAMPLE_JPEG = path.join(
  import.meta.dirname,
  "fixtures/sample-product.jpg",
);

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// customer_session/customer_account cascade-delete with the customer row.
async function cleanupCustomer(email: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "customer" WHERE email = $1', [email]);
  });
}

async function signUpCustomer(
  page: import("@playwright/test").Page,
  { name, email, password }: { name: string; email: string; password: string },
) {
  await page.goto("/account/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/account");
}

test.describe("Customer profile avatar upload", () => {
  test("uploads a real image as an avatar, renders it, and it persists across reload", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `e2e-avatar-${unique}@e2e.test`;
    const password = "customer-password-123";

    try {
      await signUpCustomer(page, {
        name: "E2E Avatar Customer",
        email,
        password,
      });

      await page.goto("/account/profile");
      // No avatar yet: the img isn't rendered, only the "Upload photo" button.
      await expect(
        page.getByRole("img", { name: "Profile picture" }),
      ).toHaveCount(0);
      await expect(
        page
          .getByRole("button", { name: "Upload photo" })
          .and(page.locator("button")),
      ).toBeVisible();

      await page.getByLabel("Upload photo").setInputFiles(SAMPLE_JPEG);

      const avatar = page.getByRole("img", { name: "Profile picture" });
      await expect(avatar).toBeVisible();
      await expect(avatar).toHaveAttribute(
        "src",
        /\/api\/uploads\/customers\/.+/,
      );
      // Real server write: the file-type-detected extension is .jpg for this fixture.
      await expect(avatar).toHaveAttribute("src", /\.jpg$/);

      // "Change photo"/"Remove photo" replace the initial upload affordance.
      await expect(
        page
          .getByRole("button", { name: "Change photo" })
          .and(page.locator("button")),
      ).toBeVisible();
      await expect(
        page
          .getByRole("button", { name: "Remove photo" })
          .and(page.locator("button")),
      ).toBeVisible();

      // Persists across reload (real DB + real file on disk, not just client state).
      await page.reload();
      await expect(
        page.getByRole("img", { name: "Profile picture" }),
      ).toBeVisible();

      // Also renders on the /account hub page.
      await page.goto("/account");
      await expect(
        page.getByRole("img", { name: "Profile picture" }),
      ).toBeVisible();
    } finally {
      await cleanupCustomer(email);
    }
  });

  test("rejects a non-image file disguised as a JPEG and sets no avatar", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `e2e-avatar-invalid-${unique}@e2e.test`;
    const password = "customer-password-123";

    try {
      await signUpCustomer(page, {
        name: "E2E Invalid Avatar",
        email,
        password,
      });

      await page.goto("/account/profile");

      // Bypasses the file input's `accept` filtering (client-side only) and the
      // declared mimetype check, exercising the server's real magic-byte
      // (file-type) detection against actual file content.
      await page.getByLabel("Upload photo").setInputFiles({
        name: "not-a-real-image.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from(
          "this is not actually a jpeg, just spoofing the mimetype",
        ),
      });

      await expect(
        page.getByText("Image must be a JPEG, PNG, or WebP file"),
      ).toBeVisible();

      // No avatar was set: still showing the placeholder / upload affordance.
      await expect(
        page.getByRole("img", { name: "Profile picture" }),
      ).toHaveCount(0);
      await expect(
        page
          .getByRole("button", { name: "Upload photo" })
          .and(page.locator("button")),
      ).toBeVisible();

      // Confirm on the real server too — the customer row has no image.
      const persisted = await withDb((client) =>
        client.query('SELECT image FROM "customer" WHERE email = $1', [email]),
      );
      expect(persisted.rows[0].image).toBeNull();
    } finally {
      await cleanupCustomer(email);
    }
  });

  test("removes an existing avatar and restores the upload placeholder", async ({
    page,
  }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = `e2e-avatar-remove-${unique}@e2e.test`;
    const password = "customer-password-123";

    try {
      await signUpCustomer(page, {
        name: "E2E Remove Avatar",
        email,
        password,
      });

      await page.goto("/account/profile");
      await page.getByLabel("Upload photo").setInputFiles(SAMPLE_JPEG);
      await expect(
        page.getByRole("img", { name: "Profile picture" }),
      ).toBeVisible();

      await page
        .getByRole("button", { name: "Remove photo" })
        .and(page.locator("button"))
        .click();

      await expect(
        page.getByRole("img", { name: "Profile picture" }),
      ).toHaveCount(0);
      await expect(
        page
          .getByRole("button", { name: "Upload photo" })
          .and(page.locator("button")),
      ).toBeVisible();
      await expect(
        page
          .getByRole("button", { name: "Remove photo" })
          .and(page.locator("button")),
      ).toHaveCount(0);

      // Persists across reload too.
      await page.reload();
      await expect(
        page.getByRole("img", { name: "Profile picture" }),
      ).toHaveCount(0);
      await expect(
        page
          .getByRole("button", { name: "Upload photo" })
          .and(page.locator("button")),
      ).toBeVisible();
    } finally {
      await cleanupCustomer(email);
    }
  });
});
