import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import ProductsPage, { type StorefrontProduct } from "./ProductsPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const products: StorefrontProduct[] = [
  {
    id: "p1",
    name: { en: "Rice 5kg", ar: "أرز ٥ كجم" },
    description: null,
    price: 1500,
    stock: 20,
    images: [],
    tags: ["organic"],
    category: { id: "c1", name: { en: "Groceries" } },
    averageRating: 4.5,
    reviewCount: 12,
  },
  {
    id: "p2",
    name: { en: "Orange Juice" },
    description: null,
    price: 300,
    stock: 0,
    images: [],
    tags: [],
    category: { id: "c2", name: { en: "Beverages" } },
    averageRating: null,
    reviewCount: 0,
  },
];

const categories = [
  { id: "c1", name: { en: "Groceries", ar: "بقالة" } },
  { id: "c2", name: { en: "Beverages" } },
];

function mockApi(overrides?: {
  products?: StorefrontProduct[];
  total?: number;
  tags?: string[];
}) {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === "/api/storefront/categories") {
      return Promise.resolve({ data: { categories } });
    }
    if (url === "/api/storefront/tags") {
      return Promise.resolve({ data: { tags: overrides?.tags ?? ["organic"] } });
    }
    return Promise.resolve({
      data: {
        products: overrides?.products ?? products,
        total: overrides?.total ?? (overrides?.products ?? products).length,
      },
    });
  });
}

function renderPage(initialEntry = "/products") {
  renderWithQuery(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ProductsPage />
    </MemoryRouter>,
  );
}

function lastProductsParams() {
  const calls = mockedAxios.get.mock.calls.filter(
    ([url]) => url === "/api/storefront/products",
  );
  return calls[calls.length - 1]![1]?.params as Record<string, unknown>;
}

describe("storefront ProductsPage", () => {
  beforeEach(async () => {
    mockedAxios.get.mockReset();
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("renders product cards with name, category, price, and an out-of-stock badge", async () => {
    mockApi();
    renderPage();

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("Orange Juice")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("1500")).toBeInTheDocument();
    // Only the zero-stock product gets the badge
    expect(screen.getAllByText("Out of stock")).toHaveLength(1);
    expect(lastProductsParams()).toEqual({ sort: "newest", page: 1 });
  });

  it("shows a rating summary only on cards with reviews", async () => {
    mockApi();
    renderPage();

    // Rice has averageRating 4.5 / 12 reviews; Orange Juice is unreviewed and
    // renders no rating line at all.
    expect(await screen.findByText("4.5 (12)")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Average rating: 4.5 out of 5 · 12 reviews"),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Average rating/)).toHaveLength(1);
  });

  it("links each product card to its detail page", async () => {
    mockApi();
    renderPage();

    expect(await screen.findByRole("link", { name: /Rice 5kg/ })).toHaveAttribute(
      "href",
      "/products/p1",
    );
  });

  it("shows product and category names in the current language with English fallback", async () => {
    await i18n.changeLanguage("ar");
    mockApi();
    renderPage();

    expect(await screen.findByText("أرز ٥ كجم")).toBeInTheDocument();
    // No Arabic translation → falls back to English
    expect(screen.getByText("Orange Juice")).toBeInTheDocument();
  });

  it("filters by search after the input is debounced", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.type(screen.getByLabelText("Search", { exact: true }), "rice");

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ search: "rice", sort: "newest", page: 1 });
    });
  });

  it("shows a clear button while searching, and clearing it removes the search filter", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search", { exact: true });
    await user.type(searchInput, "rice");
    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ search: "rice", sort: "newest", page: 1 });
    });

    await user.click(await screen.findByLabelText("Clear search"));

    expect(searchInput).toHaveValue("");
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ sort: "newest", page: 1 });
    });
  });

  it("filters by a product's tag when its badge is clicked, without navigating", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: "organic" }));

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ tag: "organic", sort: "newest", page: 1 });
    });
    // Still on the products page — the tag badge isn't the product link.
    expect(screen.getByText("Rice 5kg")).toBeInTheDocument();
  });

  it("populates the tag filter dropdown from /api/storefront/tags", async () => {
    const user = userEvent.setup();
    mockApi({ tags: ["bulk", "organic"] });
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByLabelText("Tag"));

    expect(await screen.findByRole("option", { name: "bulk" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "organic" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "All tags" })).toBeInTheDocument();
  });

  it("filters by tag via the tag dropdown", async () => {
    const user = userEvent.setup();
    mockApi({ tags: ["bulk", "organic"] });
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByLabelText("Tag"));
    await user.click(await screen.findByRole("option", { name: "bulk" }));

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ tag: "bulk", sort: "newest", page: 1 });
    });
  });

  it("combines search and tag filters", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: "organic" }));
    await user.type(screen.getByLabelText("Search", { exact: true }), "rice");

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({
        search: "rice",
        tag: "organic",
        sort: "newest",
        page: 1,
      });
    });
  });

  it("shows an empty state when a tag filter has no matches", async () => {
    mockApi({ products: [], total: 0 });
    renderPage("/products?tag=nonexistent");

    expect(await screen.findByText("No products found.")).toBeInTheDocument();
  });

  it("pre-fills the tag filter from an incoming ?tag= query param", async () => {
    mockApi({ tags: ["organic"], products: [products[0]!], total: 1 });
    renderPage("/products?tag=organic");
    await screen.findByText("Rice 5kg");

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ tag: "organic", sort: "newest", page: 1 });
    });
  });

  it("filters by category", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByLabelText("Category"));
    await user.click(await screen.findByRole("option", { name: "Groceries" }));

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ categoryId: "c1", sort: "newest", page: 1 });
    });
  });

  it("filters by price range after the inputs are debounced", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.type(screen.getByLabelText("Min price"), "100");
    await user.type(screen.getByLabelText("Max price"), "2000");

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({
        minPrice: "100",
        maxPrice: "2000",
        sort: "newest",
        page: 1,
      });
    });
  });

  it("sorts by price", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByLabelText("Sort by"));
    await user.click(await screen.findByRole("option", { name: "Price: low to high" }));

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ sort: "price-asc", page: 1 });
    });
  });

  it("shows an empty state when no products match", async () => {
    mockApi({ products: [], total: 0 });
    renderPage();

    expect(await screen.findByText("No products found.")).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("network"));
    renderPage();

    expect(
      await screen.findByText("Could not load products. Please try again."),
    ).toBeInTheDocument();
  });
});
