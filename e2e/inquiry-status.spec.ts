import { expect, test } from "@playwright/test";

// Inquiry codes come from an alphabet that omits O/0 and I/1 (read over the
// phone) — same convention as order codes, see e2e/checkout.spec.ts.
const INQUIRY_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

test.describe("Guest inquiry status lookup", () => {
  test("guest submits a contact form, gets a reference code, and can look it up later by code + email", async ({
    page,
  }) => {
    const email = `e2e-inquiry-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const message = `E2E inquiry status test message ${Date.now()}`;

    // Submit the contact form as a guest — real server round-trip.
    await page.goto("/contact");
    await page.getByLabel("Name").fill("E2E Guest");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Message").fill(message);
    await page.getByRole("button", { name: "Send message" }).click();

    // Reference code card appears after a successful submit.
    await expect(page.getByText("Your reference code")).toBeVisible();
    const code = (
      await page.getByText(INQUIRY_CODE_PATTERN).textContent()
    )?.trim();
    expect(code).toMatch(INQUIRY_CODE_PATTERN);

    // Look the inquiry up later, in a fresh navigation, with the code + the
    // matching email — status shows Open and the submitted message appears.
    await page.getByRole("link", { name: "Message status", exact: true }).click();
    await expect(page).toHaveURL("/inquiry-status");
    await page.getByLabel("Reference code").fill(code!);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Check status" }).click();

    await expect(page.getByText("Open", { exact: true })).toBeVisible();
    await expect(page.getByText(code!, { exact: true })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });

  test("looking up with the right code but a wrong email shows the not-found error, not the thread", async ({
    page,
  }) => {
    const email = `e2e-inquiry-wrong-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const message = `E2E inquiry wrong-email test message ${Date.now()}`;

    await page.goto("/contact");
    await page.getByLabel("Name").fill("E2E Guest");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Message").fill(message);
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText("Your reference code")).toBeVisible();
    const code = (
      await page.getByText(INQUIRY_CODE_PATTERN).textContent()
    )?.trim();
    expect(code).toMatch(INQUIRY_CODE_PATTERN);

    await page.goto("/inquiry-status");
    await page.getByLabel("Reference code").fill(code!);
    await page.getByLabel("Email").fill(`not-${email}`);
    await page.getByRole("button", { name: "Check status" }).click();

    await expect(
      page.getByText("No message found for this code and email."),
    ).toBeVisible();
    await expect(page.getByText(message)).not.toBeVisible();
  });
});
