import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_DATABASE_URL } from "./test-env";
import { loginAs } from "./helpers";

// Hard-deletes a throwaway promo block by English headline so repeated
// local/CI runs against the shared test DB don't accumulate rows. Mirrors the
// equivalent helper in e2e/categories.spec.ts.
async function hardDeletePromoBlock(headline: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    // `headline` is a JSON column of localized values; match on the English value.
    await client.query('DELETE FROM "promo_block" WHERE headline->>\'en\' = $1', [headline]);
  } finally {
    await client.end();
  }
}

// Fills and submits the create-promo-block dialog form. Returns once the
// dialog has closed.
async function createPromoBlock(
  page: import("@playwright/test").Page,
  {
    headline,
    copy,
    ctaLabel,
    ctaUrl,
    isActive,
  }: { headline: string; copy: string; ctaLabel: string; ctaUrl: string; isActive: boolean },
) {
  await page.getByRole("button", { name: "Create promo block" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Create promo block" })).toBeVisible();

  await dialog.getByLabel("Headline").fill(headline);
  await dialog.getByLabel("Copy").fill(copy);
  await dialog.getByLabel("CTA label").fill(ctaLabel);
  await dialog.getByLabel("CTA link").fill(ctaUrl);

  if (!isActive) {
    await dialog.getByRole("checkbox", { name: "Active (shown on the storefront)" }).click();
  }

  await dialog.getByRole("button", { name: "Create promo block" }).click();
  await expect(dialog).not.toBeVisible();
}

test.describe("Promo blocks (ADMIN create -> storefront homepage)", () => {
  test("an active promo block persists and appears on the storefront homepage; an inactive one does not", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/promo-blocks");

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const activeHeadline = `Active Promo ${suffix}`;
    const inactiveHeadline = `Inactive Promo ${suffix}`;
    const copy = "Limited time offer on select items.";
    const ctaLabel = "Shop now";
    const ctaUrl = "/products";

    try {
      // Create the active promo block.
      await createPromoBlock(page, {
        headline: activeHeadline,
        copy,
        ctaLabel,
        ctaUrl,
        isActive: true,
      });
      await expect(page.getByRole("row").filter({ hasText: activeHeadline })).toBeVisible();

      // Create the inactive promo block.
      await createPromoBlock(page, {
        headline: inactiveHeadline,
        copy,
        ctaLabel,
        ctaUrl,
        isActive: false,
      });
      const inactiveRow = page.getByRole("row").filter({ hasText: inactiveHeadline });
      await expect(inactiveRow).toBeVisible();
      await expect(inactiveRow.getByText("Inactive", { exact: true })).toBeVisible();

      // Navigate away to the storefront homepage as a fresh page load — real
      // server persistence and a separate (unauthenticated-relevant) render path.
      await page.goto("/");

      const activeCard = page.getByRole("heading", { name: activeHeadline }).locator("..");
      await expect(page.getByRole("heading", { name: activeHeadline })).toBeVisible();
      await expect(activeCard.getByText(copy)).toBeVisible();
      const cta = activeCard.getByRole("link", { name: ctaLabel });
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", ctaUrl);

      // The inactive block must not render anywhere on the homepage.
      await expect(page.getByRole("heading", { name: inactiveHeadline })).not.toBeVisible();
    } finally {
      await hardDeletePromoBlock(activeHeadline);
      await hardDeletePromoBlock(inactiveHeadline);
    }
  });
});
