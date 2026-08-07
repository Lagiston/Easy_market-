import { expect, test } from "@playwright/test";

test.describe("Storefront homepage hero (ScrollFrameAnimation)", () => {
  test("loads without crashing and shows the headline overlay", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();
    await expect(page.getByText("Geyafa")).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop the collection" })).toBeVisible();
  });

  test("both hero CTAs navigate to /products", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();
    await page.getByRole("link", { name: "Shop the collection" }).click();
    await expect(page).toHaveURL("/products");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();
    await page.getByRole("link", { name: "Discover the collection" }).click();
    await expect(page).toHaveURL("/products");
  });

  test("prefers-reduced-motion shows all overlay content statically without scrolling", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Headline overlay (children).
    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop the collection" })).toBeVisible();

    // Intro card overlay (endChildren) — visible immediately, no scroll needed.
    await expect(page.getByText("OUR STORY")).toBeVisible();
    await expect(page.getByRole("link", { name: "Discover the collection" })).toBeVisible();

    // Outro tagline overlay (outroChildren) — also visible immediately.
    await expect(
      page.getByText("One brand. Every category. Infinite ways to express yourself."),
    ).toBeVisible();
  });
});
