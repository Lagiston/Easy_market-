import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import { CartProvider } from "@/lib/cart";
import i18n from "@/i18n";
import MobileHomePage from "./MobileHomePage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "p1",
    name: { en: "Rice" },
    description: null,
    price: 1000,
    salePrice: null,
    stock: 5,
    lowStockThreshold: 2,
    images: ["/rice.jpg"],
    tags: [],
    size: null,
    color: null,
    category: { id: "c1", name: { en: "Grocery" } },
    averageRating: null,
    reviewCount: 0,
    wishlistCount: 0,
    tagNames: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const NEWEST_PRODUCTS = Array.from({ length: 7 }, (_, i) =>
  product({ id: `p${i}`, name: { en: `Product ${i}` } }),
);

const CATEGORIES = [
  { id: "c1", name: { en: "Grocery" }, imageUrl: null, homeRow: null, itemCount: 3 },
  { id: "c2", name: { en: "Electronics" }, imageUrl: null, homeRow: null, itemCount: 2 },
];

function renderPage(initialEntry = "/mobile-home") {
  renderWithQuery(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CartProvider>
        <MobileHomePage />
      </CartProvider>
    </MemoryRouter>,
  );
}

describe("MobileHomePage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedUseSession.mockReset();
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    await i18n.changeLanguage("en");

    mockedGet.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === "/api/storefront/categories") {
        return Promise.resolve({ data: { categories: CATEGORIES } });
      }
      if (url === "/api/storefront/products") {
        const categoryId = config?.params?.categoryId;
        const products = categoryId
          ? NEWEST_PRODUCTS.filter((p) => p.category.id === categoryId)
          : NEWEST_PRODUCTS;
        return Promise.resolve({ data: { products } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
  });

  it("renders hero and popular-item sections from the newest-products query", async () => {
    renderPage();

    // Hero headlines are the only <h3>s on the page — findByRole disambiguates
    // from the same product name also appearing in the (default "All") filtered
    // grid below, which is expected: with no category selected, that grid
    // shows the same newest-products list.
    expect(await screen.findByRole("heading", { level: 3, name: "Product 0" })).toBeInTheDocument();
    expect(screen.getByText("New Popular Item")).toBeInTheDocument();
    expect(screen.getAllByText("Product 3").length).toBeGreaterThan(0);
  });

  it("re-queries with the selected category and updates the filtered grid", async () => {
    renderPage();
    const electronicsChip = await screen.findByRole("button", { name: "Electronics" });

    await userEvent.click(electronicsChip);

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith(
        "/api/storefront/products",
        expect.objectContaining({ params: expect.objectContaining({ categoryId: "c2" }) }),
      ),
    );
  });

  it("toggles the wishlist heart button on a popular-item card", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { id: "cust1", name: "Jane" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockedPost.mockResolvedValueOnce({});
    renderPage();
    await screen.findAllByText("Product 3");

    const heartButtons = await screen.findAllByRole("button", { name: "Add to wishlist" });
    await userEvent.click(heartButtons[0]);

    await waitFor(() => expect(mockedPost).toHaveBeenCalled());
  });

  it("marks the Home tab active on /mobile-home", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 3, name: "Product 0" });

    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink.querySelector("svg")).toHaveClass("text-[#111]");
    const searchLink = screen.getByRole("link", { name: "Search" });
    expect(searchLink.querySelector("svg")).toHaveClass("text-neutral-400");
  });
});
