import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import { CartProvider, type CartItem } from "@/lib/cart";
import { Toaster } from "@/components/ui/sonner";
import ProductsPage, { type StorefrontProduct } from "./ProductsPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

// Product cards render WishlistButton, which reads the customer session —
// kept as a guest throughout so this file's tests stay deterministic without
// needing wishlist add/remove mocks too.
vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";

const products: StorefrontProduct[] = [
  {
    id: "p1",
    name: { en: "Rice 5kg", ar: "أرز ٥ كجم" },
    description: null,
    price: 1500,
    stock: 20,
    lowStockThreshold: 10,
    images: [],
    tags: ["organic"],
    size: null,
    color: null,
    category: { id: "c1", name: { en: "Groceries" } },
    averageRating: 4.5,
    reviewCount: 12,
    wishlistCount: 0,
    salePrice: null,
    createdAt: "2020-01-01T00:00:00.000Z",
  },
  {
    id: "p2",
    name: { en: "Orange Juice" },
    description: null,
    price: 300,
    stock: 0,
    lowStockThreshold: 10,
    images: [],
    tags: [],
    size: null,
    color: null,
    category: { id: "c2", name: { en: "Beverages" } },
    averageRating: null,
    reviewCount: 0,
    wishlistCount: 0,
    salePrice: null,
    createdAt: "2020-01-01T00:00:00.000Z",
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

function CheckoutStateProbe() {
  const location = useLocation();
  const buyNowItem = (location.state as { buyNowItem?: CartItem } | null)?.buyNowItem;
  return <div>Checkout page: {buyNowItem ? JSON.stringify(buyNowItem) : "no buy-now item"}</div>;
}

function LocationSearchProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntry = "/products") {
  renderWithQuery(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CartProvider>
        <Routes>
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/checkout" element={<CheckoutStateProbe />} />
        </Routes>
        <LocationSearchProbe />
        <Toaster />
      </CartProvider>
    </MemoryRouter>,
  );
}

// A stub detail page with a plain browser-style back button (`navigate(-1)`),
// standing in for ProductDetailPage's own navigation-away behavior — the
// point of this suite is what happens to ProductsPage's own state on return,
// not the detail page's rendering.
function ProductDetailStub() {
  const navigate = useNavigate();
  return (
    <div>
      <p>Product detail stub</p>
      <button type="button" onClick={() => navigate(-1)}>
        Go back
      </button>
    </div>
  );
}

function renderPageWithDetailRoute(initialEntry = "/products") {
  renderWithQuery(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CartProvider>
        <Routes>
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailStub />} />
        </Routes>
      </CartProvider>
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
    // Default back to a guest session every test — the one signed-in test
    // below overrides this and must not leak into the tests that follow it.
    vi.mocked(customerAuthClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
  });

  it("renders product cards with name, category, price, and an out-of-stock badge", async () => {
    mockApi();
    renderPage();

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("Orange Juice")).toBeInTheDocument();
    // "Groceries" appears twice — once as a category chip, once on the card
    expect(screen.getAllByText("Groceries").length).toBeGreaterThanOrEqual(2);
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

  it("shows a wishlist sign-in link on each card for a guest", async () => {
    mockApi();
    renderPage();

    await screen.findByText("Rice 5kg");
    const wishlistLinks = screen.getAllByRole("link", { name: "Add to wishlist" });
    expect(wishlistLinks).toHaveLength(2);
    expect(wishlistLinks[0]).toHaveAttribute("href", "/account/login");
  });

  it("toggles a card's wishlist heart for a signed-in customer", async () => {
    vi.mocked(customerAuthClient.useSession).mockReturnValue({
      data: { user: { id: "c1", name: "Jane" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/storefront/categories") return Promise.resolve({ data: { categories } });
      if (url === "/api/storefront/tags") return Promise.resolve({ data: { tags: [] } });
      if (url === "/api/customer/wishlist") return Promise.resolve({ data: { products: [] } });
      return Promise.resolve({ data: { products, total: products.length } });
    });
    mockedAxios.post.mockResolvedValueOnce({});
    renderPage();

    const heartButtons = await screen.findAllByRole("button", { name: "Add to wishlist" });
    expect(heartButtons).toHaveLength(2);

    await userEvent.click(heartButtons[0]!);

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/customer/wishlist/p1"),
    );
  });

  it("renders an Add to cart button for in-stock products and a Notify me button for out-of-stock ones", async () => {
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    const addButtons = screen.getAllByRole("button", { name: "Add to cart" });
    expect(addButtons).toHaveLength(1);
    expect(addButtons[0]).toBeEnabled();
    // Orange Juice has stock 0 — its quick-add bar swaps to "Notify me"
    // (a guest sign-in link here, since this suite keeps the session guest).
    expect(screen.getByRole("link", { name: /Notify me/ })).toHaveAttribute(
      "href",
      "/account/login",
    );
  });

  it("adds the product to the cart from the card without navigating", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    const [addRice] = screen.getAllByRole("button", { name: "Add to cart" });
    await user.click(addRice!);
    // The double-click guard disables the button briefly after each add —
    // wait it out before clicking again, same as a real (non-instant) user.
    await waitFor(() => expect(addRice).toBeEnabled());
    // A second click merges into the same line instead of duplicating it
    await user.click(addRice!);

    await waitFor(() => {
      const cart = JSON.parse(
        window.localStorage.getItem("es-market-cart") ?? "[]",
      ) as unknown[];
      expect(cart).toEqual([
        expect.objectContaining({ productId: "p1", price: 1500, quantity: 2 }),
      ]);
    });
    // Still on the products page — the button isn't part of the card link.
    expect(screen.getByText("Rice 5kg")).toBeInTheDocument();
  });

  it("shows an 'added' toast on first add and an 'updated' toast with the new quantity on a repeat add", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    const [addRice] = screen.getAllByRole("button", { name: "Add to cart" });
    await user.click(addRice!);
    expect(await screen.findByText("Rice 5kg added to cart")).toBeInTheDocument();

    await waitFor(() => expect(addRice).toBeEnabled());
    await user.click(addRice!);
    expect(
      await screen.findByText("Rice 5kg quantity updated to 2 in cart"),
    ).toBeInTheDocument();
  });

  it("briefly disables a card's Add to cart button after a click to guard against a rapid double-click", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    const [addRice] = screen.getAllByRole("button", { name: "Add to cart" });
    expect(addRice).toBeEnabled();
    await user.click(addRice!);
    expect(addRice).toBeDisabled();
    await waitFor(() => expect(addRice).toBeEnabled());
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

  it("filters by category via the chip rail", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(await screen.findByRole("button", { name: "Groceries" }));

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

  it("shows an active-filter bar with a removable pill per applied filter", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search", { exact: true }), "rice");
    await user.type(screen.getByLabelText("Min price"), "100");
    await user.type(screen.getByLabelText("Max price"), "2000");

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({
        search: "rice",
        minPrice: "100",
        maxPrice: "2000",
        sort: "newest",
        page: 1,
      });
    });

    expect(screen.getByText("2 filters")).toBeInTheDocument();
    expect(screen.getByText("rice")).toBeInTheDocument();
    expect(screen.getByText("KSh 100 – 2000")).toBeInTheDocument();

    // Removing the search pill clears only the search filter
    await user.click(screen.getByRole("button", { name: "Remove filter: rice" }));
    await waitFor(() => {
      expect(lastProductsParams()).toEqual({
        minPrice: "100",
        maxPrice: "2000",
        sort: "newest",
        page: 1,
      });
    });

    await user.click(screen.getByText("Clear all"));
    await waitFor(() => {
      expect(lastProductsParams()).toEqual({ sort: "newest", page: 1 });
    });
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });

  it("filters by availability via the availability dropdown", async () => {
    const user = userEvent.setup();
    mockApi();
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByLabelText("Availability"));
    await user.click(await screen.findByRole("option", { name: "In stock" }));

    await waitFor(() => {
      expect(lastProductsParams()).toEqual({
        availability: "inStock",
        sort: "newest",
        page: 1,
      });
    });
    expect(screen.getByText("1 filter")).toBeInTheDocument();
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

  it("fetches the next page and reflects it in the URL, replacing rather than pushing a history entry", async () => {
    const user = userEvent.setup();
    mockApi({ total: 13 });
    renderPage();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    await waitFor(() => expect(lastProductsParams()).toEqual({ sort: "newest", page: 2 }));
    expect(screen.getByTestId("location-search")).toHaveTextContent("?page=2");

    await user.click(screen.getByRole("button", { name: "Go to previous page" }));

    await waitFor(() => expect(lastProductsParams()).toEqual({ sort: "newest", page: 1 }));
    // Back to the default page — the param is dropped, not left as "?page=1".
    expect(screen.getByTestId("location-search")).toHaveTextContent("");
  });

  it("initializes the page from an incoming ?page= query param", async () => {
    mockApi({ total: 13 });
    renderPage("/products?page=2");

    await waitFor(() => expect(lastProductsParams()).toEqual({ sort: "newest", page: 2 }));
  });

  it("preserves the current page across a back-navigation from a product's detail page", async () => {
    const user = userEvent.setup();
    mockApi({ total: 13 });
    renderPageWithDetailRoute();
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    await waitFor(() => expect(lastProductsParams()).toEqual({ sort: "newest", page: 2 }));

    await user.click(screen.getByRole("link", { name: /Rice 5kg/ }));
    expect(await screen.findByText("Product detail stub")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go back" }));

    await screen.findByText("Rice 5kg");
    expect(lastProductsParams()).toEqual({ sort: "newest", page: 2 });
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
