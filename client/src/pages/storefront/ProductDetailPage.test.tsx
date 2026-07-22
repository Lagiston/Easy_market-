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

const product: StorefrontProduct = {
  id: "p1",
  name: { en: "Rice 5kg", ar: "أرز ٥ كجم" },
  description: { en: "Long grain rice", ar: "أرز طويل الحبة" },
  price: 1500,
  stock: 20,
  imageUrl: null,
  tags: [],
  category: { id: "c1", name: { en: "Groceries" } },
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
});
