import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { CartItem } from "@/lib/cart";
import { renderWithQuery } from "@/test/render-with-query";
import { CartProvider } from "@/lib/cart";
import { Toaster } from "@/components/ui/sonner";
import i18n from "@/i18n";
import AccountWishlistPage from "./AccountWishlistPage";

function CheckoutStateProbe() {
  const location = useLocation();
  const buyNowItem = (location.state as { buyNowItem?: CartItem } | null)?.buyNowItem;
  return <div>Checkout page: {buyNowItem ? JSON.stringify(buyNowItem) : "no buy-now item"}</div>;
}

function renderPage() {
  renderWithQuery(
    <MemoryRouter initialEntries={["/account/wishlist"]}>
      <CartProvider>
        <Routes>
          <Route path="/account/wishlist" element={<AccountWishlistPage />} />
          <Route path="/checkout" element={<CheckoutStateProbe />} />
        </Routes>
        <Toaster />
      </CartProvider>
    </MemoryRouter>,
  );
}

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);

const products = [
  {
    id: "p1",
    name: { en: "Rice 5kg" },
    description: null,
    price: 1500,
    stock: 20,
    images: [],
    tags: [],
    size: null,
    color: null,
    category: { id: "c1", name: { en: "Groceries" } },
    averageRating: null,
    reviewCount: 0,
    backInStock: false,
    priceDropped: false,
    priceAtSave: null,
  },
];

describe("AccountWishlistPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    window.localStorage.clear();
    mockedAxios.get.mockReset();
    mockedAxios.delete.mockReset();
    mockedUseSession.mockReturnValue({
      data: { user: { id: "c1", name: "Jane" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
  });

  it("renders the customer's wishlisted products", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderPage();

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("1500")).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/customer/wishlist");
  });

  it("shows an empty state when the wishlist is empty", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products: [] } });
    renderPage();

    expect(
      await screen.findByText("You haven't wishlisted any products yet."),
    ).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("network"));
    renderPage();

    expect(
      await screen.findByText("Could not load your wishlist. Please try again."),
    ).toBeInTheDocument();
  });

  it("removes a product and refetches the list", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    mockedAxios.delete.mockResolvedValue({});
    renderPage();

    const removeButton = await screen.findByRole("button", {
      name: "Remove Rice 5kg from wishlist",
    });
    await userEvent.click(removeButton);

    await waitFor(() =>
      expect(mockedAxios.delete).toHaveBeenCalledWith("/api/customer/wishlist/p1"),
    );
    // Invalidation refetches: initial load + post-remove.
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
  });

  it("adds a wishlisted product to the cart", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderPage();

    const addButton = await screen.findByRole("button", { name: "Add to cart" });
    await userEvent.click(addButton);

    const stored = JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]");
    expect(stored).toEqual([
      {
        productId: "p1",
        name: { en: "Rice 5kg" },
        price: 1500,
        imageUrl: null,
        stock: 20,
        size: null,
        color: null,
        quantity: 1,
      },
    ]);
  });

  it("shows a toast when adding a wishlisted product to the cart", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Add to cart" }));

    expect(await screen.findByText("Rice 5kg added to cart")).toBeInTheDocument();
  });

  it("shows a toast when buying a wishlisted product now", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Buy now" }));

    expect(await screen.findByText("Heading to checkout for Rice 5kg")).toBeInTheDocument();
  });

  it("disables the add-to-cart button when the product is out of stock", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { products: [{ ...products[0]!, stock: 0 }] },
    });
    renderPage();

    expect(await screen.findByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(await screen.findByRole("button", { name: "Buy now" })).toBeDisabled();
  });

  it("navigates to checkout with a buy-now item, without touching the cart", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Buy now" }));

    expect(
      await screen.findByText(
        `Checkout page: ${JSON.stringify({
          productId: "p1",
          name: { en: "Rice 5kg" },
          price: 1500,
          imageUrl: null,
          stock: 20,
          size: null,
          color: null,
          quantity: 1,
        })}`,
      ),
    ).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]")).toEqual([]);
  });

  it("shows an out-of-stock badge", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { products: [{ ...products[0]!, stock: 0 }] },
    });
    renderPage();

    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
  });

  it("shows a back-in-stock badge and banner for an item that was saved while out of stock", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { products: [{ ...products[0]!, backInStock: true }] },
    });
    renderPage();

    expect(await screen.findByText("Back in stock")).toBeInTheDocument();
    expect(
      screen.getByText("1 of your wishlisted items is back in stock!"),
    ).toBeInTheDocument();
  });

  it("pluralizes the back-in-stock banner for multiple items", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        products: [
          { ...products[0]!, id: "p1", backInStock: true },
          { ...products[0]!, id: "p2", name: { en: "Orange Juice" }, backInStock: true },
        ],
      },
    });
    renderPage();

    expect(
      await screen.findByText("2 of your wishlisted items are back in stock!"),
    ).toBeInTheDocument();
  });

  it("shows neither the badge nor the banner when nothing is back in stock", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderPage();

    await screen.findByText("Rice 5kg");
    expect(screen.queryByText("Back in stock")).not.toBeInTheDocument();
    expect(screen.queryByText(/back in stock!/)).not.toBeInTheDocument();
  });

  it("shows only the out-of-stock badge, not back-in-stock, when currently out of stock", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { products: [{ ...products[0]!, stock: 0, backInStock: true }] },
    });
    renderPage();

    await screen.findByText("Rice 5kg");
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.queryByText("Back in stock")).not.toBeInTheDocument();
  });

  it("shows a price-drop badge, banner, and the old price struck through", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        products: [{ ...products[0]!, price: 1200, priceDropped: true, priceAtSave: 1500 }],
      },
    });
    renderPage();

    expect(await screen.findByText("Price drop")).toBeInTheDocument();
    expect(
      screen.getByText("1 of your wishlisted items dropped in price!"),
    ).toBeInTheDocument();
    expect(screen.getByText("1500")).toHaveClass("line-through");
    expect(screen.getByText("1200")).toBeInTheDocument();
  });

  it("pluralizes the price-drop banner for multiple items", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        products: [
          { ...products[0]!, id: "p1", priceDropped: true, priceAtSave: 1600 },
          {
            ...products[0]!,
            id: "p2",
            name: { en: "Orange Juice" },
            priceDropped: true,
            priceAtSave: 400,
          },
        ],
      },
    });
    renderPage();

    expect(
      await screen.findByText("2 of your wishlisted items dropped in price!"),
    ).toBeInTheDocument();
  });

  it("shows neither the price-drop badge nor banner when nothing dropped in price", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderPage();

    await screen.findByText("Rice 5kg");
    expect(screen.queryByText("Price drop")).not.toBeInTheDocument();
    expect(screen.queryByText(/dropped in price!/)).not.toBeInTheDocument();
    expect(screen.getByText("1500")).not.toHaveClass("line-through");
  });
});
