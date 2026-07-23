import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios, { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import ProductDetailPage from "./ProductDetailPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);

const product = {
  id: "p1",
  name: { en: "Rice 5kg", ar: "أرز ٥ كجم" },
  description: { en: "Long grain rice" },
  price: 1500,
  stock: 20,
  lowStockThreshold: 10,
  images: [],
  category: { id: "c1", name: { en: "Groceries" } },
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-02T10:00:00.000Z",
};

function renderPage() {
  renderWithQuery(
    <MemoryRouter initialEntries={["/admin/products/p1"]}>
      <Routes>
        <Route path="/admin/products/:id" element={<ProductDetailPage />} />
      </Routes>
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

describe("ProductDetailPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("fetches the product by id and renders its details", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    // Name appears in the card title and again in the Translations section
    expect(await screen.findAllByText("Rice 5kg")).toHaveLength(2);
    expect(mockedGet).toHaveBeenCalledWith("/api/products/p1");
    expect(screen.getByText("1500")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    // Translations section lists present locales only
    expect(screen.getByText("Arabic")).toBeInTheDocument();
    expect(screen.getByText("أرز ٥ كجم")).toBeInTheDocument();
    expect(screen.getByText("Long grain rice")).toBeInTheDocument();
    expect(screen.queryByText("Swahili")).not.toBeInTheDocument();
  });

  it("renders a back link to the products list", async () => {
    mockedGet.mockResolvedValueOnce({ data: { product } });
    renderPage();

    expect(await screen.findByRole("link", { name: /back to products/i })).toHaveAttribute(
      "href",
      "/admin/products",
    );
  });

  it("shows a not-found message when the product does not exist", async () => {
    mockedGet.mockRejectedValueOnce(axiosErrorWithStatus(404));
    renderPage();

    expect(await screen.findByText("Product not found.")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedGet.mockRejectedValueOnce(axiosErrorWithStatus(500));
    renderPage();

    expect(
      await screen.findByText("Could not load product. Please try again."),
    ).toBeInTheDocument();
  });
});
