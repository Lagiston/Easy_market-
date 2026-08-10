import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./test-env";

// New-format inquiry codes carry a fixed "MSG" prefix (see
// server/src/lib/inquiry-code.ts) — 8 characters total, 5 random from the
// same restricted alphabet as order codes (omits O/0/I/1).
const MESSAGE_CODE_PATTERN = /^MSG[A-HJ-NP-Z2-9]{5}$/;

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// The redesigned ContactPage.tsx success card no longer shows the inquiry's
// reference code anywhere in the UI, so fetch it straight from the DB by the
// phone number just submitted (unique per test run).
async function getInquiryCodeByPhone(phone: string): Promise<string> {
  return withDb(async (client) => {
    const result = await client.query(
      'SELECT code FROM "inquiry" WHERE "customerPhone" = $1 ORDER BY "createdAt" DESC LIMIT 1',
      [phone],
    );
    if (result.rows.length === 0) {
      throw new Error(`No inquiry found for phone ${phone}`);
    }
    return result.rows[0].code as string;
  });
}

async function cleanupInquiry(phone: string) {
  await withDb(async (client) => {
    await client.query('DELETE FROM "inquiry" WHERE "customerPhone" = $1', [phone]);
  });
}

async function submitContactForm(
  page: import("@playwright/test").Page,
  { name, phone, message }: { name: string; phone: string; message: string },
) {
  await page.goto("/contact");
  await page.getByRole("combobox", { name: /What's this about\?/ }).click();
  await page.getByRole("option", { name: "Product question" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Phone").fill(phone);
  await page.getByLabel("Message").fill(message);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Message sent")).toBeVisible();
}

test.describe("Track page — message mode (guest inquiry lookup)", () => {
  test("guest submits a contact form and can look the message up later by code + phone", async ({
    page,
  }) => {
    const phone = `07${Date.now().toString().slice(-8)}`;
    const message = `E2E track message test ${Date.now()}`;

    try {
      await submitContactForm(page, { name: "E2E Guest", phone, message });

      const code = await getInquiryCodeByPhone(phone);
      expect(code).toMatch(MESSAGE_CODE_PATTERN);

      // Fresh navigation via the merged Track page — no nav link exists for
      // it anymore (deep-link-only), so this navigates directly and switches
      // into message mode.
      await page.goto("/track");

      await page.getByRole("button", { name: "My message" }).click();
      await expect(page.getByLabel("Message code")).toBeVisible();

      await page.getByLabel("Message code").fill(code);
      await page.getByLabel("Phone number").fill(phone);
      await page.getByRole("button", { name: "Check status" }).click();

      await expect(page.getByText(code, { exact: true })).toBeVisible();
      await expect(page.getByText("Message received")).toBeVisible();
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByText("Open", { exact: true }).first()).toBeVisible();
    } finally {
      await cleanupInquiry(phone);
    }
  });

  test("short /t/:code deep link auto-detects message mode from the MSG prefix, focuses phone, and shows nothing until confirmed", async ({
    page,
  }) => {
    const phone = `07${Date.now().toString().slice(-8)}`;
    const message = `E2E track deep link test ${Date.now()}`;

    try {
      await submitContactForm(page, { name: "E2E Guest", phone, message });
      const code = await getInquiryCodeByPhone(phone);

      await page.goto(`/t/${code.toLowerCase()}`);

      // Auto-detected message mode (MSG prefix), code prefilled/uppercased,
      // and focus lands on the phone field, not the code field.
      await expect(page.getByRole("button", { name: "My message" })).toBeVisible();
      await expect(page.getByLabel("Message code")).toHaveValue(code);
      await expect(page.getByLabel("Phone number")).toBeFocused();
      await expect(
        page.getByText("Confirm your phone number to see the latest status."),
      ).toBeVisible();

      // Security property: arriving via the link alone exposes nothing.
      await expect(page.getByText(message)).not.toBeVisible();

      await page.getByLabel("Phone number").fill(phone);
      await page.getByRole("button", { name: "Check status" }).click();

      await expect(page.getByText(code, { exact: true })).toBeVisible();
      await expect(page.getByText(message)).toBeVisible();
    } finally {
      await cleanupInquiry(phone);
    }
  });

  test("looking up with the right code but a wrong phone shows the not-found error, not the thread", async ({
    page,
  }) => {
    const phone = `07${Date.now().toString().slice(-8)}`;
    const message = `E2E track wrong-phone test ${Date.now()}`;

    try {
      await submitContactForm(page, { name: "E2E Guest", phone, message });
      const code = await getInquiryCodeByPhone(phone);

      await page.goto("/track");
      await page.getByRole("button", { name: "My message" }).click();
      await page.getByLabel("Message code").fill(code);
      // A different, still-valid-looking phone number.
      await page.getByLabel("Phone number").fill("0798765432");
      await page.getByRole("button", { name: "Check status" }).click();

      await expect(
        page.getByText(
          "No message matches that code and phone number. Double-check both, or start a chat with us.",
        ),
      ).toBeVisible();
      await expect(page.getByText(message)).not.toBeVisible();
    } finally {
      await cleanupInquiry(phone);
    }
  });

  test("mode toggle switches the form between order and message labels/placeholders", async ({
    page,
  }) => {
    await page.goto("/track");

    await expect(page.getByLabel("Order code")).toBeVisible();

    await page.getByRole("button", { name: "My message" }).click();
    await expect(page.getByLabel("Message code")).toBeVisible();
    await expect(page.getByLabel("Message code")).toHaveAttribute("placeholder", "MSG4K2P9");

    await page.getByRole("button", { name: "My order" }).click();
    await expect(page.getByLabel("Order code")).toBeVisible();
  });
});
