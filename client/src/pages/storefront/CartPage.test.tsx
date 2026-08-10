import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { CartProvider, type CartItem } from "@/lib/cart";
import CartPage from "./CartPage";

const items: CartItem[] = [
  {
    productId: "p1",
    name: { en: "Rice 5kg", ar: "أرز ٥ كجم" },
    price: 1500,
    imageUrl: null,
    stock: 20,
    quantity: 2,
  },
  {
    productId: "p2",
    name: { en: "Sunflower Oil" },
    price: 800,
    imageUrl: null,
    stock: 3,
    quantity: 3,
  },
];

function seedCart(cartItems: CartItem[]) {
  window.localStorage.setItem("es-market-cart", JSON.stringify(cartItems));
}

function storedCart(): CartItem[] {
  return JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]");
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/cart"]}>
      <CartProvider>
        <CartPage />
      </CartProvider>
    </MemoryRouter>,
  );
}

describe("storefront CartPage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("shows an empty state with a link to the products page", () => {
    renderPage();

    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument();
  });

  it("renders the persisted items with quantities, line totals, and the subtotal", () => {
    seedCart(items);
    renderPage();

    expect(screen.getByRole("link", { name: "Rice 5kg" })).toHaveAttribute(
      "href",
      "/products/p1",
    );
    expect(screen.getByText("Sunflower Oil")).toBeInTheDocument();
    // Line totals: 1500×2 and 800×3
    expect(screen.getByText("3,000")).toBeInTheDocument();
    expect(screen.getByText("2,400")).toBeInTheDocument();
    // Subtotal: 3000 + 2400
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("5,400")).toBeInTheDocument();
  });

  it("increments the quantity and persists it", async () => {
    seedCart(items);
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Increase quantity of Rice 5kg" }),
    );

    expect(screen.getByText("4,500")).toBeInTheDocument(); // 1500×3
    expect(storedCart().find((item) => item.productId === "p1")?.quantity).toBe(3);
  });

  it("decrements the quantity and disables the decrease button at one", async () => {
    seedCart([{ ...items[0], quantity: 2 }]);
    renderPage();

    const decrease = screen.getByRole("button", {
      name: "Decrease quantity of Rice 5kg",
    });
    await userEvent.click(decrease);

    expect(storedCart()[0].quantity).toBe(1);
    expect(decrease).toBeDisabled();
  });

  it("disables the increase button when the quantity reaches the stock", () => {
    seedCart(items);
    renderPage();

    // Sunflower Oil already at quantity 3 of stock 3
    expect(
      screen.getByRole("button", { name: "Increase quantity of Sunflower Oil" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase quantity of Rice 5kg" }),
    ).toBeEnabled();
  });

  it("removes an item and persists the removal", async () => {
    seedCart(items);
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Rice 5kg from cart" }),
    );

    expect(screen.queryByText("Rice 5kg")).not.toBeInTheDocument();
    expect(storedCart().map((item) => item.productId)).toEqual(["p2"]);
  });

  it("renders localized item names for the current language", async () => {
    await i18n.changeLanguage("ar");
    seedCart(items);
    renderPage();

    expect(screen.getByText("أرز ٥ كجم")).toBeInTheDocument();
    // No Arabic translation → English fallback
    expect(screen.getByText("Sunflower Oil")).toBeInTheDocument();
  });

  it("links the checkout button to the checkout page", () => {
    seedCart(items);
    renderPage();

    expect(screen.getByRole("link", { name: "Proceed to checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });

  it("ignores malformed localStorage content", () => {
    window.localStorage.setItem("es-market-cart", "not json");
    renderPage();

    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
  });
});
