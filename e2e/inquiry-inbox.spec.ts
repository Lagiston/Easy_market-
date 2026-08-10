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

// The staff-reply route's SMS is fire-and-forget (server/src/routes/inquiries.ts's
// fireInquiryReplySms), so the SmsLog row may not exist yet the instant the
// reply's HTTP response returns — poll briefly rather than asserting immediately.
async function pollInquirySmsLogRow(
  inquiryId: string,
  { timeoutMs = 5000, intervalMs = 200 } = {},
): Promise<{ to: string; status: string } | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await withDb((client) =>
      client.query('SELECT "to", status FROM "sms_log" WHERE "inquiryId" = $1 LIMIT 1', [
        inquiryId,
      ]),
    );
    if (found.rows.length > 0) return found.rows[0];
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
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
          customerPhone: "+255700123456",
          topic: "PRODUCT_QUESTION",
          message: initialMessage,
        },
      });
      expect(seedResponse.ok()).toBe(true);
      const { inquiry } = (await seedResponse.json()) as { inquiry: { id: string } };

      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

      // Scope to the nav landmark, not `exact: true` — the nav link's own
      // accessible name grows an "N inquiries need attention" badge suffix
      // whenever the attention count is nonzero (as it now genuinely can be,
      // since this seeded inquiry has valid topic/customerPhone and shows up
      // unassigned/open), and the dashboard's "Open inquiries"/"Escalated
      // inquiries" stat-card links also contain "Inquiries" as a substring.
      await page
        .getByRole("navigation")
        .getByRole("link", { name: /^Inquiries/ })
        .click();
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

      // The fire-and-forget AI classification/drafting pipeline (server/src/lib/inquiry-classification.ts,
      // inquiry-draft.ts) now genuinely runs against this seeded inquiry since it has a
      // valid topic/customerPhone, and may have already produced a pending AI_DRAFT with
      // its own "Draft reply" textarea by the time this page loads — match the staff
      // reply box by its exact accessible name so it isn't ambiguous with that one.
      const replyBox = page.getByRole("textbox", { name: "Reply", exact: true });
      await replyBox.fill(replyMessage);
      await page.getByRole("button", { name: "Send reply" }).click();

      // Exact match: once the SMS notifications section (below) also renders
      // a "Halatu: reply to <code>: <replyMessage>" row, a substring match on
      // just replyMessage becomes ambiguous between the thread bubble and
      // that SMS log entry's message preview.
      await expect(page.getByText(replyMessage, { exact: true })).toBeVisible();
      await expect(replyBox).toHaveValue("");

      // The reply also fires an SMS notification (fire-and-forget) — verify
      // the log row lands in the DB, normalized to E.164 from the seeded
      // "+255700123456" (already E.164 here, so this also confirms toE164()
      // is a no-op on an already-normalized number), then that the detail
      // page's SMS notifications section reflects it once reloaded/refetched.
      const smsRow = await pollInquirySmsLogRow(inquiry.id);
      expect(smsRow).not.toBeNull();
      expect(smsRow!.status).toBe("SKIPPED");
      expect(smsRow!.to).toBe("+255700123456");

      await page.reload();
      await expect(page.getByRole("heading", { name: "SMS notifications" })).toBeVisible();
      await expect(
        page.getByText("Not sent (no SMS provider configured)").first(),
      ).toBeVisible();

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
