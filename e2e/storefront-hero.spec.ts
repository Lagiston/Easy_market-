import { expect, test } from "@playwright/test";

test.describe("Storefront homepage hero (ScrollFrameAnimation)", () => {
  test("loads without crashing and shows the headline overlay", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Halatu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop the collection" })).toBeVisible();
  });

  test("hero CTA navigates to /products", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();
    await page.getByRole("link", { name: "Shop the collection" }).click();
    await expect(page).toHaveURL("/products");
  });

  test("prefers-reduced-motion shows the headline overlay statically without scrolling", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Headline overlay (children) — visible immediately, no scroll needed.
    await expect(page.getByRole("heading", { name: "Serve looks. Head to toe." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop the collection" })).toBeVisible();
  });
});

// "Our story" content moved back into the scroll-jacked hero as
// ScrollFrameAnimation's `endChildren` (a left-center glass card) and
// `pillarsChildren` (a bottom-right set of three labelled pillars), both in
// HomePage.tsx. Under normal motion these fade in sequentially via scroll
// progress (opacity-0 + pointer-events: none until scrolled into range), so
// they're only asserted here under prefers-reduced-motion, where
// ScrollFrameAnimation renders both directly and immediately visible with no
// scroll needed.
test.describe("Storefront homepage 'Our story' content", () => {
  test("prefers-reduced-motion shows the 'Our story' content statically without scrolling", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(page.getByText("OUR STORY")).toBeVisible();
    await expect(
      page.getByText("For people who choose to stand out, not blend in."),
    ).toBeVisible();
  });

  test("prefers-reduced-motion shows the pillars statically without scrolling", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(page.getByText("One brand")).toBeVisible();
    await expect(
      page.getByText("Wigs, makeup, clothing, shoes, bags and jewellery under one roof."),
    ).toBeVisible();

    await expect(page.getByText("Every category")).toBeVisible();
    await expect(
      page.getByText("From a daring new wig to the perfect heels — and the details between."),
    ).toBeVisible();

    await expect(page.getByText("Infinite ways to wear it")).toBeVisible();
    await expect(
      page.getByText("Dress it up, play it down, remix it for what's next."),
    ).toBeVisible();
  });
});
