import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter, Route, Routes } from "react-router";
import i18n from "@/i18n";
import { CartProvider, type CartItem } from "@/lib/cart";
import { renderWithQuery } from "@/test/render-with-query";
import CheckoutPage from "./CheckoutPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

const cartItems: CartItem[] = [
  {
    productId: "p1",
    name: { en: "Rice 5kg" },
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
    stock: 5,
    quantity: 1,
  },
];
// Subtotal: 1500×2 + 800 = 3800

function seedCart(items: CartItem[] = cartItems) {
  window.localStorage.setItem("es-market-cart", JSON.stringify(items));
}

function mockSettings(deliveryFee = 200, freeDeliveryThreshold: number | null = null) {
  mockedGet.mockResolvedValue({ data: { settings: { deliveryFee, freeDeliveryThreshold } } });
}

function renderPage() {
  renderWithQuery(
    <MemoryRouter initialEntries={["/checkout"]}>
      <CartProvider>
        <Routes>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/confirmation" element={<div>Confirmation page</div>} />
          <Route path="/cart" element={<div>Cart page</div>} />
        </Routes>
      </CartProvider>
    </MemoryRouter>,
  );
}

async function fillCustomerFields() {
  await userEvent.type(screen.getByLabelText("Name"), "Jane Doe");
  await userEvent.type(screen.getByLabelText("Phone"), "0712345678");
}

describe("storefront CheckoutPage", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("redirects to the cart when it is empty", async () => {
    mockSettings();
    renderPage();

    expect(await screen.findByText("Cart page")).toBeInTheDocument();
  });

  it("renders the summary with subtotal, delivery fee, and total", async () => {
    seedCart();
    mockSettings(200);
    renderPage();

    expect(await screen.findByText("Rice 5kg × 2")).toBeInTheDocument();
    expect(screen.getByText("Sunflower Oil × 1")).toBeInTheDocument();
    // Delivery is the default → the configured fee applies once settings load
    expect(await screen.findByText("200")).toBeInTheDocument();
    expect(screen.getByText("3800")).toBeInTheDocument();
    expect(screen.getByText("4000")).toBeInTheDocument();
  });

  it("shows free delivery when the subtotal reaches the threshold", async () => {
    seedCart();
    mockSettings(200, 3000); // subtotal 3800 ≥ 3000
    renderPage();

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getAllByText("3800").length).toBeGreaterThanOrEqual(1); // total = subtotal
  });

  it("switching to pickup hides the address field and zeroes the fee", async () => {
    seedCart();
    mockSettings(200);
    renderPage();

    expect(await screen.findByLabelText("Address")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Delivery or pickup"));
    await userEvent.click(await screen.findByRole("option", { name: "Pickup" }));

    expect(screen.queryByLabelText("Address")).not.toBeInTheDocument();
    expect(await screen.findByText("Free")).toBeInTheDocument();
  });

  it("shows validation errors, including a required address for delivery", async () => {
    seedCart();
    mockSettings();
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Place order" }));

    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("A valid phone number is required")).toBeInTheDocument();
    expect(screen.getByText("Address is required for delivery")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("places the order, clears the cart, and navigates to the confirmation", async () => {
    seedCart();
    mockSettings(200);
    mockedPost.mockResolvedValueOnce({
      data: { order: { code: "ABCD2345", items: [], subtotal: 3800, deliveryFee: 200, total: 4000 } },
    });
    renderPage();

    await fillCustomerFields();
    await userEvent.type(await screen.findByLabelText("Address"), "12 Main Street");
    await userEvent.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByText("Confirmation page")).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/storefront/orders",
      expect.objectContaining({
        customerName: "Jane Doe",
        customerPhone: "0712345678",
        fulfillmentType: "DELIVERY",
        address: "12 Main Street",
        items: [
          { productId: "p1", quantity: 2 },
          { productId: "p2", quantity: 1 },
        ],
      }),
    );
    expect(JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]")).toEqual([]);
  });

  it("shows the server error when placement fails", async () => {
    seedCart();
    mockSettings();
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedPost.mockRejectedValueOnce(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        data: { error: "Not enough stock for Rice 5kg" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderPage();

    await fillCustomerFields();
    await userEvent.type(await screen.findByLabelText("Address"), "12 Main Street");
    await userEvent.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByText("Not enough stock for Rice 5kg")).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]")).toHaveLength(2),
    );
  });
});
