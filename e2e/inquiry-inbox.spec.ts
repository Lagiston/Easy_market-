import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_DATABASE_URL } from "./test-env";
import { loginAs } from "./helpers";

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Hard-deletes the inquiry (its messages cascade), matching e2e/inquiries.spec.ts's
// cleanup style — no future entity references an Inquiry.
async function cleanupInquiry(email: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "inquiry" WHERE "customerEmail" = $1', [email]);
  });
}

test.describe("Inquiry inbox (staff)", () => {
  test("staff logs in, claims a seeded inquiry, replies, and resolves it", async ({
    page,
    request,
  }) => {
    const email = `e2e-inbox-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const customerName = "E2E Inbox Customer";
    const initialMessage = "Do you have this product in stock at the store?";
    const replyMessage = "Yes, it's currently in stock — feel free to come by.";

    try {
      // Seed a real inquiry via the public storefront route, bypassing the
      // chat/contact widget UI so this spec only exercises the staff inbox.
      const seedResponse = await request.post("/api/storefront/inquiries", {
        data: {
          customerName,
          customerEmail: email,
          message: initialMessage,
        },
      });
      expect(seedResponse.ok()).toBe(true);
      const { inquiry } = (await seedResponse.json()) as { inquiry: { id: string } };

      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

      await page.getByRole("link", { name: "Inquiries" }).click();
      await expect(page).toHaveURL("/admin/inquiries");

      // Unassigned tab is deterministic regardless of other seeded/leftover data.
      await page.getByRole("tab", { name: "Unassigned" }).click();

      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toBeVisible();
      await expect(row.getByText("Unassigned", { exact: true })).toBeVisible();

      // Claim from the list. Claiming assigns it to the logged-in admin, so it
      // drops out of the Unassigned queue — switch to "My queue" to confirm.
      await row.getByRole("button", { name: `Claim inquiry from ${customerName}` }).click();
      await expect(row).not.toBeVisible();

      await page.getByRole("tab", { name: "My queue" }).click();
      const myQueueRow = page.getByRole("row").filter({ hasText: email });
      await expect(myQueueRow).toBeVisible();
      await expect(myQueueRow.getByText("E2E Admin", { exact: true })).toBeVisible();

      // Open the detail page to reply and resolve.
      await myQueueRow.getByRole("link", { name: customerName }).click();
      await expect(page).toHaveURL(`/admin/inquiries/${inquiry.id}`);

      await expect(page.getByText(initialMessage)).toBeVisible();
      await expect(page.getByLabel("Assigned to")).toContainText("E2E Admin");

      const replyBox = page.getByRole("textbox", { name: "Reply" });
      await replyBox.fill(replyMessage);
      await page.getByRole("button", { name: "Send reply" }).click();

      await expect(page.getByText(replyMessage)).toBeVisible();
      await expect(replyBox).toHaveValue("");

      await page.getByRole("button", { name: "Resolve" }).click();
      await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Resolve" })).not.toBeVisible();

      // Real persistence: status, assignee, and the staff reply all round-tripped
      // through the real server/DB.
      const persisted = await withDb((client) =>
        client.query(
          `SELECT i.status, u.name AS "assignedAgentName",
                  (SELECT count(*)::int FROM "message" m
                    WHERE m."inquiryId" = i.id AND m.sender = 'STAFF' AND m.body = $2) AS "replyCount"
           FROM "inquiry" i
           JOIN "user" u ON u.id = i."assignedAgentId"
           WHERE i.id = $1`,
          [inquiry.id, replyMessage],
        ),
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0].status).toBe("RESOLVED");
      expect(persisted.rows[0].assignedAgentName).toBe("E2E Admin");
      expect(persisted.rows[0].replyCount).toBe(1);
    } finally {
      await cleanupInquiry(email);
    }
  });
});
