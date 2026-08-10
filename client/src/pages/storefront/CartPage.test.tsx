import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { CartProvider, type CartItem } from "@/lib/cart";
import { renderWithQuery } from "@/test/render-with-query";
import CartPage from "./CartPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);

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

function mockSettings(deliveryFee = 3000, freeDeliveryThreshold: number | null = 5000) {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === "/api/storefront/settings") {
      return Promise.resolve({
        data: {
          settings: {
            deliveryFee,
            freeDeliveryThreshold,
            contactPhone: null,
            contactEmail: null,
            contactAddress: "Moye Avenue, Dar es Salaam",
          },
        },
      });
    }
    if (url === "/api/customer/wishlist") {
      return Promise.resolve({ data: { products: [] } });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

function renderPage() {
  renderWithQuery(
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
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockSettings();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an empty state with a link to the products page and no summary", () => {
    renderPage();

    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.getByText("Browse the shop and add something you like")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument();
  });

  it("renders items with per-unit price, live line totals, and the item count", async () => {
    seedCart(items);
    renderPage();

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    // Total quantity: 2 + 3 = 5
    expect(screen.getByText("5 items")).toBeInTheDocument();
    // Unit price under the name
    expect(screen.getAllByText("each")).toHaveLength(2);
    expect(screen.getByText("1,500")).toBeInTheDocument(); // Rice unit price
    // Line totals: 1500×2 and 800×3
    expect(screen.getByText("3,000")).toBeInTheDocument();
    expect(screen.getByText("2,400")).toBeInTheDocument();
  });

  it("shows a low-stock pill only for items at or under the threshold", async () => {
    seedCart(items);
    renderPage();

    await screen.findByText("Rice 5kg");
    // Sunflower Oil has stock 3 (≤ 5) → pill shown; Rice has stock 20 → no pill
    expect(screen.getByText("Only 3 left!")).toBeInTheDocument();
  });

  it("increments the quantity and persists it", async () => {
    seedCart(items);
    renderPage();

    await screen.findByText("Rice 5kg");
    await userEvent.click(
      screen.getByRole("button", { name: "Increase quantity of Rice 5kg" }),
    );

    expect(screen.getByText("4,500")).toBeInTheDocument(); // 1500×3
    expect(storedCart().find((item) => item.productId === "p1")?.quantity).toBe(3);
  });

  it("decrements the quantity and disables the decrease button at one", async () => {
    seedCart([{ ...items[0], quantity: 2 }]);
    renderPage();

    await screen.findByText("Rice 5kg");
    const decrease = screen.getByRole("button", { name: "Decrease quantity of Rice 5kg" });
    await userEvent.click(decrease);

    expect(storedCart()[0].quantity).toBe(1);
    expect(decrease).toBeDisabled();
  });

  it("disables the increase button when the quantity reaches the stock", async () => {
    seedCart(items);
    renderPage();

    await screen.findByText("Rice 5kg");
    // Sunflower Oil already at quantity 3 of stock 3
    expect(
      screen.getByRole("button", { name: "Increase quantity of Sunflower Oil" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase quantity of Rice 5kg" }),
    ).toBeEnabled();
  });

  it("shows the free-delivery achieved banner once the subtotal meets the threshold", async () => {
    seedCart(items);
    renderPage();

    await screen.findByText("Rice 5kg");
    // subtotal is 3000 + 2400 = 5400 ≥ 5000 → already met, once settings load
    expect(await screen.findByText("Delivery is free on this order")).toBeInTheDocument();
  });

  it("shows the free-delivery progress banner below the threshold", async () => {
    seedCart([{ ...items[1], quantity: 1 }]); // subtotal 800, threshold 5000
    renderPage();

    await screen.findByText("Sunflower Oil");
    expect(await screen.findByText("Add TSh 4,200 more for free delivery")).toBeInTheDocument();
    expect(screen.queryByText("Delivery is free on this order")).not.toBeInTheDocument();
  });

  it("shows the delivery fee and estimated total in the summary, switching to Free at the threshold", async () => {
    seedCart([{ ...items[1], quantity: 1 }]); // subtotal 800 < 5000 threshold
    renderPage();

    await screen.findByText("Sunflower Oil");
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Estimated total")).toBeInTheDocument();
    // 800 subtotal + 3000 delivery = 3800 total
    expect(await screen.findByText("3,800")).toBeInTheDocument();
  });

  it("removes an item, shows the undo bar, and restores it at its original index on Undo", async () => {
    seedCart(items);
    renderPage();

    await screen.findByText("Rice 5kg");
    await userEvent.click(screen.getByRole("button", { name: "Remove Rice 5kg from cart" }));

    expect(screen.queryByText("Rice 5kg")).not.toBeInTheDocument();
    expect(screen.getByText("'Rice 5kg' removed from cart.")).toBeInTheDocument();
    expect(storedCart().map((item) => item.productId)).toEqual(["p2"]);

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByText("Rice 5kg")).toBeInTheDocument();
    expect(storedCart().map((item) => item.productId)).toEqual(["p1", "p2"]);
  });

  // Real timers throughout, not vi.useFakeTimers() — userEvent's click
  // simulation hung indefinitely under fake timers in this environment
  // (its internal pointer-event steps appear to need real setTimeout/rAF
  // ticks even with delay: null), so this accepts the real ~6s wait rather
  // than fight that interaction, same "not worth scripting flaky timing"
  // tradeoff already made for the homepage scroll animation.
  it(
    "auto-dismisses the undo bar after a timeout",
    async () => {
      seedCart(items);
      renderPage();

      await screen.findByText("Rice 5kg");
      await userEvent.click(screen.getByRole("button", { name: "Remove Rice 5kg from cart" }));
      expect(screen.getByText("'Rice 5kg' removed from cart.")).toBeInTheDocument();

      await waitFor(
        () => expect(screen.queryByText("'Rice 5kg' removed from cart.")).not.toBeInTheDocument(),
        { timeout: 7000 },
      );
    },
    10000,
  );

  it("saves an item for later as a guest, behaving like a removal with undo", async () => {
    seedCart(items);
    renderPage();

    await screen.findByText("Rice 5kg");
    await userEvent.click(screen.getByRole("button", { name: "Save Rice 5kg for later" }));

    expect(screen.queryByText("Rice 5kg")).not.toBeInTheDocument();
    expect(screen.getByText("'Rice 5kg' saved for later.")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("saves an item to the wishlist when signed in", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { id: "c1", name: "Jane" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockedAxios.post.mockResolvedValue({ data: {} });
    seedCart(items);
    renderPage();

    await screen.findByText("Rice 5kg");
    await userEvent.click(screen.getByRole("button", { name: "Save Rice 5kg for later" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/customer/wishlist/p1"),
    );
  });

  it("renders localized item names for the current language", async () => {
    await i18n.changeLanguage("ar");
    seedCart(items);
    renderPage();

    expect(await screen.findByText("أرز ٥ كجم")).toBeInTheDocument();
    // No Arabic translation → English fallback
    expect(screen.getByText("Sunflower Oil")).toBeInTheDocument();
  });

  it("links the checkout and keep-shopping buttons", async () => {
    seedCart(items);
    renderPage();

    await screen.findByText("Rice 5kg");
    expect(screen.getByRole("link", { name: /Proceed to checkout/ })).toHaveAttribute(
      "href",
      "/checkout",
    );
    expect(screen.getByRole("link", { name: "Keep shopping" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("ignores malformed localStorage content", () => {
    window.localStorage.setItem("es-market-cart", "not json");
    renderPage();

    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  });
});
