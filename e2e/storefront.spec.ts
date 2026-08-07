import { expect, test } from "@playwright/test";

test.describe("Storefront shell", () => {
  test("anonymous visit to / renders the storefront home in English", async ({ page }) => {
    await page.goto("/");

    // No redirect to the staff login — the storefront is public.
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Welcome to Halatu" })).toBeVisible();
    await expect(page.getByText("Browse our products")).toBeVisible();

    // Header: brand link + Home nav link + language switcher.
    await expect(page.getByRole("link", { name: "Halatu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Language" })).toBeVisible();

    // Footer copyright.
    await expect(page.getByText(`© ${new Date().getFullYear()} Halatu`)).toBeVisible();

    // Default document language/direction.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("switching to Arabic flips RTL, persists across reload, and English restores LTR", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome to Halatu" })).toBeVisible();

    // Switch to Arabic.
    await page.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "العربية" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "مرحبًا بكم في إي إس ماركت" }),
    ).toBeVisible();

    // The choice persists across a reload (localStorage "language" key).
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "مرحبًا بكم في إي إس ماركت" }),
    ).toBeVisible();

    // Switch back to English (the switcher's label is now in Arabic).
    await page.getByRole("combobox", { name: "اللغة" }).click();
    await page.getByRole("option", { name: "English" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "Welcome to Halatu" })).toBeVisible();
  });
});
