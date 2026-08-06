import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, it, expect, beforeEach } from "vitest";
import i18n from "@/i18n";
import { CartProvider } from "@/lib/cart";
import SiteHeader from "./SiteHeader";

function renderHeader(initialEntry = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <CartProvider>
          <Routes>
            <Route element={<SiteHeader />} path="*" />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SiteHeader", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("renders the brand link pointing to the storefront root", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "ES-Market" })).toHaveAttribute("href", "/");
  });

  it("marks the active nav link", () => {
    renderHeader("/products");
    const productsLinks = screen.getAllByRole("link", { name: "Products" });
    const desktopLink = productsLinks.find((link) => link.closest("nav")?.getAttribute("aria-label") === "Main navigation");
    expect(desktopLink).toHaveClass("bg-primary/10");

    const homeLinks = screen.getAllByRole("link", { name: "Home" });
    const desktopHomeLink = homeLinks.find((link) => link.closest("nav")?.getAttribute("aria-label") === "Main navigation");
    expect(desktopHomeLink).not.toHaveClass("bg-primary/10");
  });

  it("keeps the Products nav link active on a nested product detail route", () => {
    renderHeader("/products/abc123");
    const productsLinks = screen.getAllByRole("link", { name: "Products" });
    const desktopLink = productsLinks.find((link) => link.closest("nav")?.getAttribute("aria-label") === "Main navigation");
    expect(desktopLink).toHaveClass("bg-primary/10");
  });

  it("opens the mobile menu sheet and shows the nav links", async () => {
    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(
      screen.getAllByRole("link", { name: "Contact" }).some((link) => dialog.contains(link)),
    ).toBe(true);
  });

  it("keeps the mobile sheet open after toggling the theme", async () => {
    renderHeader();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the total item quantity on the cart badge", () => {
    window.localStorage.setItem(
      "es-market-cart",
      JSON.stringify([
        { productId: "p1", name: { en: "Rice" }, price: 100, imageUrl: null, stock: 10, quantity: 2 },
      ]),
    );
    renderHeader();
    expect(screen.getByRole("link", { name: "Cart, 2 items" })).toHaveTextContent("2");
  });
});
