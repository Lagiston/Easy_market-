import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, it, expect, beforeEach } from "vitest";
import i18n from "@/i18n";
import { CartProvider } from "@/lib/cart";
import StorefrontLayout from "./StorefrontLayout";

function renderLayout() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <CartProvider>
        <Routes>
          <Route element={<StorefrontLayout />}>
            <Route index element={<div>Page content</div>} />
          </Route>
        </Routes>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe("StorefrontLayout", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("renders the brand link pointing to the storefront root", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "ES-Market" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders a nav link to the products page", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("renders a nav link to the contact page", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("renders the language switcher", () => {
    renderLayout();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders the child route content in the outlet", () => {
    renderLayout();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders a cart link without a badge when the cart is empty", () => {
    renderLayout();
    const cartLink = screen.getByRole("link", { name: "Cart" });
    expect(cartLink).toHaveAttribute("href", "/cart");
    expect(cartLink).toHaveTextContent("");
  });

  it("shows the total item quantity on the cart badge", () => {
    window.localStorage.setItem(
      "es-market-cart",
      JSON.stringify([
        { productId: "p1", name: { en: "Rice" }, price: 100, imageUrl: null, stock: 10, quantity: 2 },
        { productId: "p2", name: { en: "Oil" }, price: 200, imageUrl: null, stock: 5, quantity: 1 },
      ]),
    );
    renderLayout();
    expect(screen.getByRole("link", { name: "Cart" })).toHaveTextContent("3");
  });
});
