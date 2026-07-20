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

// Hard-deletes the inquiry (its messages cascade), mirroring e2e/inquiries.spec.ts
// — an Inquiry is never referenced by another entity, so a real hard delete is
// fine for test cleanup on the shared test DB.
async function cleanupInquiry(email: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "inquiry" WHERE "customerEmail" = $1', [email]);
  });
}

test.describe("Storefront chat widget", () => {
  test("guest starts a chat, sends a follow-up, and resumes the thread after reload", async ({
    page,
  }) => {
    const email = `e2e-chat-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const name = "E2E Chat Tester";
    const phone = "+255700987654";
    const firstMessage = "Hello, do you have fresh tomatoes in stock right now?";
    const followUpMessage = "Also, what time does the store close today?";

    try {
      await page.goto("/");

      await page.getByRole("button", { name: "Open chat" }).click();

      await page.getByLabel("Name").fill(name);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Phone").fill(phone);
      await page.getByLabel("Message").fill(firstMessage);
      await page.getByRole("button", { name: "Start chat" }).click();

      // Switches from the start form to the thread view, showing the first message.
      await expect(page.getByText(firstMessage)).toBeVisible();

      // Real persistence: the inquiry and its first customer message exist,
      // created via the real POST /api/storefront/inquiries round trip.
      const afterStart = await withDb((client) =>
        client.query(
          `SELECT i.id, i.status, i."customerEmail", m.sender, m.body
           FROM "inquiry" i
           JOIN "message" m ON m."inquiryId" = i.id
           WHERE i."customerEmail" = $1
           ORDER BY m."createdAt" ASC`,
          [email],
        ),
      );
      expect(afterStart.rows).toHaveLength(1);
      expect(afterStart.rows[0].status).toBe("OPEN");
      expect(afterStart.rows[0].sender).toBe("CUSTOMER");
      expect(afterStart.rows[0].body).toBe(firstMessage);
      const inquiryId: string = afterStart.rows[0].id;

      // Send a follow-up through the reply box (icon-only send button, so
      // locate it relative to the labeled reply textbox instead of by name).
      const replyBox = page.getByRole("textbox", { name: "Message" });
      await replyBox.fill(followUpMessage);
      await replyBox
        .locator("xpath=ancestor::form[1]")
        .getByRole("button")
        .click();

      await expect(page.getByText(followUpMessage)).toBeVisible();

      const afterReply = await withDb((client) =>
        client.query(
          `SELECT sender, body FROM "message" WHERE "inquiryId" = $1 ORDER BY "createdAt" ASC`,
          [inquiryId],
        ),
      );
      expect(afterReply.rows).toHaveLength(2);
      expect(afterReply.rows[1].sender).toBe("CUSTOMER");
      expect(afterReply.rows[1].body).toBe(followUpMessage);

      // Reload the page: the widget should resume the same thread from the
      // localStorage-stored inquiry id, proving the GET route + client
      // session helper work together across a real reload.
      await page.reload();
      await page.getByRole("button", { name: "Open chat" }).click();

      await expect(page.getByText(firstMessage)).toBeVisible();
      await expect(page.getByText(followUpMessage)).toBeVisible();
    } finally {
      await cleanupInquiry(email);
    }
  });
});
