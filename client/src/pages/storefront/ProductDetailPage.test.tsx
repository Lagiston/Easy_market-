import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios, { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { CartItem } from "@/lib/cart";
import i18n from "@/i18n";
import { CartProvider } from "@/lib/cart";
import { Toaster } from "@/components/ui/sonner";
import { renderWithQuery } from "@/test/render-with-query";
import ProductDetailPage from "./ProductDetailPage";
import type { StorefrontProduct } from "./ProductsPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);

// This page renders WishlistButton, which reads the customer session — kept
// as a guest throughout so this file's existing (unauthenticated-scoped)
// tests stay deterministic without needing wishlist add/remove mocks too.
vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
vi.mocked(customerAuthClient.useSession).mockReturnValue({
  data: null,
  isPending: false,
} as unknown as ReturnType<typeof customerAuthClient.useSession>);

const product: StorefrontProduct = {
  id: "p1",
  name: { en: "Rice 5kg", ar: "أرز ٥ كجم" },
  description: { en: "Long grain rice", ar: "أرز طويل الحبة" },
  price: 1500,
  salePrice: null,
  stock: 20,
  lowStockThreshold: 10,
  images: [],
  tags: [],
  size: null,
  color: null,
  category: { id: "c1", name: { en: "Groceries" } },
  averageRating: null,
  reviewCount: 0,
  wishlistCount: 0,
  createdAt: "2020-01-01T00:00:00.000Z",
};

function CheckoutStateProbe() {
  const location = useLocation();
  const buyNowItem = (location.state as { buyNowItem?: CartItem } | null)?.buyNowItem;
  return <div>Checkout page: {buyNowItem ? JSON.stringify(buyNowItem) : "no buy-now item"}</div>;
}

function ProductsListStub() {
  const location = useLocation();
  return (
    <div>
      Products list stub<span data-testid="location-search">{location.search}</span>
    </div>
  );
}

function renderPage(initialEntries: string[] = ["/products/p1"]) {
  renderWithQuery(
    <MemoryRouter initialEntries={initialEntries}>
      <CartProvider>
        <Routes>
          <Route path="/products" element={<ProductsListStub />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutStateProbe />} />
        </Routes>
        <Toaster />
      </CartProvider>
    </MemoryRouter>,
  );
}

function axiosErrorWithStatus(status: number) {
  return new AxiosError("Request failed", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data: { error: "Product not found" },
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe("storefront ProductDetailPage", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    // Per-test mockResolvedValueOnce calls (the product fetch) are consumed
    // before this fallback, which then serves the reviews query the embedded
    // ProductReviews section fires after the product loads.
    mockedGet.mockImplementation((url: string) =>
      url.endsWith("/reviews")
        ? Promise.resolve({
            data: { reviews: [], total: 0, averageRating: null, page: 1, pageSize: 10 },
          })
        : Promise.reject(new Error(`Unexpected GET ${url}`)),
    );
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("fetches the product and renders name, category, price, and description", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith("/api/storefront/products/p1");
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("1500")).toBeInTheDocument();
    expect(screen.getByText("Long grain rice")).toBeInTheDocument();
    // In stock → no out-of-stock badge
    expect(screen.queryByText("Out of stock")).not.toBeInTheDocument();
  });

  it("shows a rating summary under the title when the product has reviews", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { product: { ...product, averageRating: 4.5, reviewCount: 12 } },
    });
    renderPage();

    expect(
      await screen.findByLabelText("Average rating: 4.5 out of 5 · 12 reviews"),
    ).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "12 reviews" })).toHaveAttribute("href", "#reviews");
  });

  it("shows a wishlist-count social-proof line when others have wishlisted it", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { product: { ...product, wishlistCount: 12 } },
    });
    renderPage();

    expect(
      await screen.findByText("12 people have this in their wishlist"),
    ).toBeInTheDocument();
  });

  it("shows the singular wishlist-count line for exactly one save", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { product: { ...product, wishlistCount: 1 } },
    });
    renderPage();

    expect(
      await screen.findByText("1 person has this in their wishlist"),
    ).toBeInTheDocument();
  });

  it("shows no wishlist-count line when nobody has wishlisted it", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    await screen.findByText("Rice 5kg");
    expect(screen.queryByText(/in their wishlist/)).not.toBeInTheDocument();
  });

  it("shows an out-of-stock badge when stock is zero", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product: { ...product, stock: 0 } } });
    renderPage();

    // "Out of stock" renders twice — once as the gallery badge, once as the
    // price panel's stock line.
    expect(await screen.findAllByText("Out of stock")).toHaveLength(2);
    expect(screen.queryByText(/left!/)).not.toBeInTheDocument();
  });

  it("shows a low-stock urgency badge when stock is below the threshold", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { product: { ...product, stock: 3, lowStockThreshold: 10 } },
    });
    renderPage();

    expect(await screen.findByText("Only 3 left!")).toBeInTheDocument();
    expect(screen.queryByText("Out of stock")).not.toBeInTheDocument();
  });

  it("shows no urgency badge when stock is at or above the threshold", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    await screen.findByText("Rice 5kg");
    expect(screen.queryByText(/left!/)).not.toBeInTheDocument();
  });

  it("renders localized content with English fallback for the current language", async () => {
    await i18n.changeLanguage("ar");
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    expect(await screen.findByText("أرز ٥ كجم")).toBeInTheDocument();
    expect(screen.getByText("أرز طويل الحبة")).toBeInTheDocument();
    // Category has no Arabic translation → English fallback
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("navigates to the plain product list when there's no in-app history to go back to", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValueOnce({ data: { product } });
    // Single initial entry ⇒ location.key === "default": a fresh load/shared
    // link, where a real history-back would leave the app entirely.
    renderPage();

    await user.click(await screen.findByRole("button", { name: /back to products/i }));

    expect(await screen.findByText("Products list stub")).toBeInTheDocument();
  });

  it("goes back in history (preserving the list's page/filters) when reached via in-app navigation", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValueOnce({ data: { product } });
    // Two entries ⇒ this page was reached by navigating from the list, so
    // location.key !== "default" and the back button should pop history
    // instead of forcing a fresh /products navigation.
    renderPage(["/products?page=2", "/products/p1"]);

    await user.click(await screen.findByRole("button", { name: /back to products/i }));

    await screen.findByText("Products list stub");
    expect(screen.getByTestId("location-search")).toHaveTextContent("?page=2");
  });

  it("renders tags as links back to the product list, filtered by that tag", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product: { ...product, tags: ["organic"] } } });
    renderPage();

    expect(await screen.findByRole("link", { name: "organic" })).toHaveAttribute(
      "href",
      "/products?tag=organic",
    );
  });

  it("renders no tag links when the product has no tags", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    await screen.findByText("Rice 5kg");
    // Only the guest wishlist sign-in link should exist — no tag chips to
    // render, and "back to products" is a button, not a link.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows a not-found message when the product does not exist", async () => {
    mockedGet.mockRejectedValueOnce(axiosErrorWithStatus(404));
    renderPage();

    expect(await screen.findByText("Product not found.")).toBeInTheDocument();
  });

  it("adds the product to the cart persisted in localStorage", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    const button = await screen.findByRole("button", { name: /add to cart/i });
    await userEvent.click(button);
    await userEvent.click(button);

    const stored = JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]");
    expect(stored).toEqual([
      {
        productId: "p1",
        name: product.name,
        price: 1500,
        imageUrl: null,
        stock: 20,
        quantity: 2,
        size: null,
        color: null,
      },
    ]);
  });

  it("disables the add-to-cart button when the product is out of stock", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product: { ...product, stock: 0 } } });
    renderPage();

    expect(await screen.findByRole("button", { name: /add to cart/i })).toBeDisabled();
    expect(await screen.findByRole("button", { name: /buy now/i })).toBeDisabled();
    // No quantity stepper to interact with when there's nothing to add.
    expect(screen.queryByLabelText(/increase quantity/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/decrease quantity/i)).not.toBeInTheDocument();
  });

  it("navigates to checkout with the chosen quantity as a buy-now item, without touching the cart", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    const increase = await screen.findByLabelText(/increase quantity/i);
    await userEvent.click(increase);
    await userEvent.click(screen.getByRole("button", { name: /buy now/i }));

    expect(
      await screen.findByText(
        `Checkout page: ${JSON.stringify({
          productId: "p1",
          name: product.name,
          price: 1500,
          imageUrl: null,
          stock: 20,
          size: null,
          color: null,
          quantity: 2,
        })}`,
      ),
    ).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]")).toEqual([]);
  });

  it("adds the chosen quantity to the cart via the quantity stepper", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    const increase = await screen.findByLabelText(/increase quantity/i);
    await userEvent.click(increase);
    await userEvent.click(increase);
    await userEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    const stored = JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]");
    expect(stored).toEqual([
      {
        productId: "p1",
        name: product.name,
        price: 1500,
        imageUrl: null,
        stock: 20,
        quantity: 3,
        size: null,
        color: null,
      },
    ]);
  });

  it("disables the increase button once quantity reaches available stock", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product: { ...product, stock: 2 } } });
    renderPage();

    const increase = await screen.findByLabelText(/increase quantity/i);
    await userEvent.click(increase);

    expect(increase).toBeDisabled();
  });

  it("disables the decrease button at a quantity of one", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    expect(await screen.findByLabelText(/decrease quantity/i)).toBeDisabled();
  });

  it("shows a toast when adding to cart", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /add to cart/i }));

    expect(await screen.findByText("Rice 5kg added to cart")).toBeInTheDocument();
  });

  it("shows a toast when buying now", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /buy now/i }));

    expect(await screen.findByText("Heading to checkout for Rice 5kg")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedGet.mockRejectedValueOnce(axiosErrorWithStatus(500));
    renderPage();

    expect(
      await screen.findByText("Could not load products. Please try again."),
    ).toBeInTheDocument();
  });

  it("renders no related-products section when there are none", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product, relatedProducts: [] } });
    renderPage();

    await screen.findByText("Rice 5kg");
    expect(screen.queryByText("Related products")).not.toBeInTheDocument();
  });

  it("renders a related-products section linking to each sibling", async () => {
    const sibling: StorefrontProduct = {
      id: "p2",
      name: { en: "Rice 10kg" },
      description: null,
      price: 2800,
      salePrice: null,
      stock: 0,
      lowStockThreshold: 10,
      images: [],
      tags: [],
      size: null,
      color: null,
      category: { id: "c1", name: { en: "Groceries" } },
      averageRating: 3.5,
      reviewCount: 2,
      wishlistCount: 0,
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    mockedGet.mockResolvedValueOnce({ data: { product, relatedProducts: [sibling] } });
    renderPage();

    expect(await screen.findByText("Related products")).toBeInTheDocument();
    expect(screen.getByText("Rice 10kg")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Rice 10kg/ })).toHaveAttribute(
      "href",
      "/products/p2",
    );
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });
});
