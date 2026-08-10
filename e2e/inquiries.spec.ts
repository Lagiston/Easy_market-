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

// Hard-deletes the inquiry (its messages cascade), so repeated runs against
// the shared test DB don't accumulate rows — no future entity references an
// Inquiry, so this is a real hard delete, not the soft-delete convention.
async function cleanupInquiry(email: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "inquiry" WHERE "customerEmail" = $1', [email]);
  });
}

test.describe("Contact form", () => {
  test("guest submits the contact form, sees the success message, and the inquiry + message persist in the DB", async ({
    page,
  }) => {
    const email = `e2e-contact-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const name = "E2E Contact Tester";
    const phone = "+255700123456";
    const message = "Hello, I have a question about product availability in-store.";

    try {
      await page.goto("/contact");
      await expect(page.getByRole("heading", { name: "Contact us" })).toBeVisible();

      await page.getByRole("combobox", { name: /what's this about/i }).click();
      await page.getByRole("option", { name: "Product question" }).click();

      await page.getByLabel("Name").fill(name);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Phone").fill(phone);
      await page.getByLabel("Message").fill(message);

      await page.getByRole("button", { name: "Send message" }).click();

      // The form unmounts on success and is replaced by a success card — it
      // isn't reset in place, so the old fields no longer exist at all.
      await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
      await expect(page.getByLabel("Name")).not.toBeVisible();

      // Real persistence: the inquiry and its first customer message exist,
      // created via the real POST /api/storefront/inquiries round trip.
      const persisted = await withDb((client) =>
        client.query(
          `SELECT i.channel, i.status, i.topic, i."customerName", i."customerEmail", i."customerPhone",
                  m.sender, m.body
           FROM "inquiry" i
           JOIN "message" m ON m."inquiryId" = i.id
           WHERE i."customerEmail" = $1`,
          [email],
        ),
      );
      expect(persisted.rows).toHaveLength(1);
      const row = persisted.rows[0];
      expect(row.channel).toBe("WEBSITE");
      expect(row.status).toBe("OPEN");
      expect(row.topic).toBe("PRODUCT_QUESTION");
      expect(row.customerName).toBe(name);
      expect(row.customerEmail).toBe(email);
      expect(row.customerPhone).toBe(phone);
      expect(row.sender).toBe("CUSTOMER");
      expect(row.body).toBe(message);
    } finally {
      await cleanupInquiry(email);
    }
  });
});
