import { expect, test } from "@playwright/test";

test.describe("Storefront site header navigation", () => {
  test("desktop: clicking a pill-nav link navigates", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toBeVisible();

    await nav.getByRole("link", { name: "Products", exact: true }).click();

    await expect(page).toHaveURL("/products");
  });

  test("mobile: menu button opens the sheet, and a link inside navigates and closes it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();

    // The desktop pill nav is hidden below `lg`.
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();

    const menuButton = page.getByRole("button", { name: "Menu" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();

    await sheet.getByRole("link", { name: "Contact", exact: true }).click();

    await expect(page).toHaveURL("/contact");
    await expect(sheet).toBeHidden();
  });
});
