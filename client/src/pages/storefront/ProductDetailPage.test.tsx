import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios, { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router";
import i18n from "@/i18n";
import { CartProvider } from "@/lib/cart";
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
  stock: 20,
  images: [],
  tags: [],
  size: null,
  color: null,
  category: { id: "c1", name: { en: "Groceries" } },
  averageRating: null,
  reviewCount: 0,
  wishlistCount: 0,
};

function renderPage() {
  renderWithQuery(
    <MemoryRouter initialEntries={["/products/p1"]}>
      <CartProvider>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
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

    expect(await screen.findByText("4.5 (12)")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Average rating: 4.5 out of 5 · 12 reviews"),
    ).toBeInTheDocument();
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

    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
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

  it("renders a back link to the product list", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    expect(await screen.findByRole("link", { name: /back to products/i })).toHaveAttribute(
      "href",
      "/products",
    );
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
    // Only "back to products" and the guest wishlist sign-in link should
    // exist — no tag chips to render.
    expect(screen.getAllByRole("link")).toHaveLength(2);
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
      stock: 0,
      images: [],
      tags: [],
      size: null,
      color: null,
      category: { id: "c1", name: { en: "Groceries" } },
      averageRating: 3.5,
      reviewCount: 2,
      wishlistCount: 0,
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
