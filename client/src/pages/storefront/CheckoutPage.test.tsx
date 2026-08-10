import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter, Route, Routes } from "react-router";
import i18n from "@/i18n";
import { CartProvider, type CartItem } from "@/lib/cart";
import { renderWithQuery } from "@/test/render-with-query";
import { Toaster } from "@/components/ui/sonner";
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

// Defaults every test to a guest (no session) — the prefill/save-address
// tests below override this to a signed-in session.
vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn(), updateUser: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);
const mockedUpdateUser = vi.mocked(customerAuthClient.updateUser);

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

function renderPage(
  initialEntries: (string | { pathname: string; state?: unknown })[] = ["/checkout"],
) {
  renderWithQuery(
    <MemoryRouter initialEntries={initialEntries}>
      <CartProvider>
        <Routes>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/confirmation" element={<div>Confirmation page</div>} />
          <Route path="/cart" element={<div>Cart page</div>} />
        </Routes>
        <Toaster />
      </CartProvider>
    </MemoryRouter>,
  );
}

const buyNowItem: CartItem = {
  productId: "p3",
  name: { en: "Cooking Oil 3L" },
  price: 780,
  imageUrl: null,
  stock: 10,
  quantity: 2,
};

async function fillCustomerFields() {
  await userEvent.type(screen.getByLabelText(/Full name/), "Jane Doe");
  await userEvent.type(screen.getByLabelText(/^Phone \*$/), "712345678");
}

async function fillDeliveryAddressFields() {
  await userEvent.type(screen.getByLabelText(/Area \/ ward/), "Kinondoni");
  await userEvent.type(
    screen.getByLabelText(/Nearest landmark/),
    "opposite the Total petrol station",
  );
}

describe("storefront CheckoutPage", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedUpdateUser.mockReset();
    window.localStorage.clear();
    await i18n.changeLanguage("en");
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
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

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("Sunflower Oil")).toBeInTheDocument();
    // Delivery is the default → the configured fee applies once settings load
    expect(await screen.findAllByText("200")).not.toHaveLength(0);
    expect(screen.getAllByText("3,800").length).toBeGreaterThanOrEqual(1); // subtotal
    expect(screen.getByText("4,000")).toBeInTheDocument(); // total due
  });

  it("shows free delivery when the subtotal reaches the threshold", async () => {
    seedCart();
    mockSettings(200, 3000); // subtotal 3800 ≥ 3000
    renderPage();

    expect(await screen.findAllByText("Free")).not.toHaveLength(0);
    expect(screen.getAllByText("3,800").length).toBeGreaterThanOrEqual(1); // total = subtotal
  });

  it("switching to pickup hides the address fields and zeroes the fee", async () => {
    seedCart();
    mockSettings(200);
    renderPage();

    expect(await screen.findByLabelText(/Area \/ ward/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Store pickup" }));

    expect(screen.queryByLabelText(/Area \/ ward/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Nearest landmark/)).not.toBeInTheDocument();
    expect(await screen.findAllByText("Free")).not.toHaveLength(0);
  });

  it("shows validation errors, including required area/landmark for delivery", async () => {
    seedCart();
    mockSettings();
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /Place order/ }));

    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("A valid phone number is required")).toBeInTheDocument();
    expect(screen.getByText("Area / ward is required for delivery")).toBeInTheDocument();
    expect(screen.getByText("Nearest landmark is required for delivery")).toBeInTheDocument();
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
    await fillDeliveryAddressFields();
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));

    expect(await screen.findByText("Confirmation page")).toBeInTheDocument();
    // Posts the raw pre-transform fields (area/street/landmark), not a
    // client-joined `address` string — placeOrderSchema computes the
    // canonical address server-side from these same raw fields, mirroring
    // checkoutFormSchema's own transform (see CheckoutPage.tsx's mutationFn
    // comment). Sending an already-joined `address` instead 400ed with
    // "Area / ward is required for delivery" every time in a real E2E run.
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/storefront/orders",
      expect.objectContaining({
        customerName: "Jane Doe",
        customerPhone: "+255712345678",
        fulfillmentType: "DELIVERY",
        area: "Kinondoni",
        landmark: "opposite the Total petrol station",
        items: [
          { productId: "p1", quantity: 2 },
          { productId: "p2", quantity: 1 },
        ],
      }),
    );
    expect(JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]")).toEqual([]);
  });

  it("places a pickup order with no address fields required", async () => {
    seedCart();
    mockSettings(200);
    mockedPost.mockResolvedValueOnce({
      data: { order: { code: "ABCD2345", items: [], subtotal: 3800, deliveryFee: 0, total: 3800 } },
    });
    renderPage();

    await fillCustomerFields();
    await userEvent.click(screen.getByRole("button", { name: "Store pickup" }));
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));

    expect(await screen.findByText("Confirmation page")).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/storefront/orders",
      expect.objectContaining({ fulfillmentType: "PICKUP", area: "", landmark: "" }),
    );
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
    await fillDeliveryAddressFields();
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));

    expect(await screen.findByText("Not enough stock for Rice 5kg")).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]")).toHaveLength(2),
    );
  });

  it("changes an item's quantity and removes an item from the summary", async () => {
    seedCart();
    mockSettings(200);
    renderPage();

    await screen.findByText("Rice 5kg");
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity of Rice 5kg" }));
    // Rice line total goes from 3000 (1500×2) to 4500 (1500×3)
    expect(await screen.findByText("4,500")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove Sunflower Oil from cart" }));
    expect(screen.queryByText("Sunflower Oil")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]")).toHaveLength(1);
  });

  it("redirects to the cart when the last item is removed from the summary", async () => {
    seedCart([cartItems[0]]);
    mockSettings(200);
    renderPage();

    await screen.findByText("Rice 5kg");
    await userEvent.click(screen.getByRole("button", { name: "Remove Rice 5kg from cart" }));

    expect(await screen.findByText("Cart page")).toBeInTheDocument();
  });

  it("checks out a buy-now item passed via location state, with an empty cart", async () => {
    mockSettings(200);
    renderPage([{ pathname: "/checkout", state: { buyNowItem } }]);

    expect(await screen.findByText("Cooking Oil 3L")).toBeInTheDocument();
    expect(screen.getAllByText("1,560").length).toBeGreaterThanOrEqual(2); // line total and subtotal, both 780 × 2
    expect(screen.queryByText("Cart page")).not.toBeInTheDocument();
  });

  it("places a buy-now order without touching pre-existing cart items", async () => {
    seedCart(); // unrelated items already in the cart
    mockSettings(200);
    mockedPost.mockResolvedValueOnce({
      data: { order: { code: "BUYNOW1", items: [], subtotal: 1560, deliveryFee: 200, total: 1760 } },
    });
    renderPage([{ pathname: "/checkout", state: { buyNowItem } }]);

    await fillCustomerFields();
    await fillDeliveryAddressFields();
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));

    expect(await screen.findByText("Confirmation page")).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/storefront/orders",
      expect.objectContaining({ items: [{ productId: "p3", quantity: 2 }] }),
    );
    // The pre-existing cart (seeded via seedCart()) must survive untouched.
    expect(JSON.parse(window.localStorage.getItem("es-market-cart") ?? "[]")).toEqual(cartItems);
  });

  it("shows no save-address checkbox and no prefill for a guest", async () => {
    seedCart();
    mockSettings();
    renderPage();

    expect(await screen.findByLabelText(/Area \/ ward/)).toHaveValue("");
    expect(screen.getByLabelText(/Full name/)).toHaveValue("");
    expect(screen.queryByText("Save this address to my profile")).not.toBeInTheDocument();
  });

  it("prefills name and mobile from a signed-in customer's saved profile", async () => {
    mockedUseSession.mockReturnValue({
      data: {
        user: {
          name: "Jane Doe",
          mobile: "+255712345678",
          address: "12 Main Street",
        },
        session: {},
      },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    seedCart();
    mockSettings();
    renderPage();

    expect(await screen.findByLabelText(/Full name/)).toHaveValue("Jane Doe");
    expect(screen.getByLabelText(/^Phone \*$/)).toHaveValue("712345678");
    // No address prefill — the saved flat address string doesn't split back
    // into area/street/landmark.
    expect(screen.getByLabelText(/Area \/ ward/)).toHaveValue("");
  });

  it("does not write back to the profile when the save-address checkbox is left unchecked", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: "Jane Doe", mobile: null, address: null }, session: {} },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    seedCart();
    mockSettings(200);
    mockedPost.mockResolvedValueOnce({
      data: { order: { code: "ABCD2345", items: [], subtotal: 3800, deliveryFee: 200, total: 4000 } },
    });
    renderPage();

    await screen.findByDisplayValue("Jane Doe");
    await userEvent.type(screen.getByLabelText(/^Phone \*$/), "712345678");
    await fillDeliveryAddressFields();
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));

    await screen.findByText("Confirmation page");
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("writes the edited name/mobile/address back to the profile when the checkbox is checked", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: "Jane Doe", mobile: null, address: null }, session: {} },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockedUpdateUser.mockResolvedValue({ data: {}, error: null } as unknown as ReturnType<
      typeof customerAuthClient.updateUser
    >);
    seedCart();
    mockSettings(200);
    // The write-back uses the server-computed `order.address` (the
    // canonical joined string, since the mutation now posts the raw
    // area/landmark fields rather than a client-joined address).
    mockedPost.mockResolvedValueOnce({
      data: {
        order: {
          code: "ABCD2345",
          items: [],
          subtotal: 3800,
          deliveryFee: 200,
          total: 4000,
          address: "Kinondoni — Landmark: opposite the Total petrol station",
        },
      },
    });
    renderPage();

    await screen.findByDisplayValue("Jane Doe");
    await userEvent.type(screen.getByLabelText(/^Phone \*$/), "712345678");
    await fillDeliveryAddressFields();
    await userEvent.click(screen.getByText("Save this address to my profile"));
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));

    await screen.findByText("Confirmation page");
    await waitFor(() =>
      expect(mockedUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Jane Doe",
          mobile: "+255712345678",
          address: "Kinondoni — Landmark: opposite the Total petrol station",
        }),
      ),
    );
  });

  it("shows a toast but does not block confirmation when the write-back fails", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: "Jane Doe", mobile: null, address: null }, session: {} },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockedUpdateUser.mockResolvedValue({
      data: null,
      error: { message: "Session expired" },
    } as unknown as ReturnType<typeof customerAuthClient.updateUser>);
    seedCart();
    mockSettings(200);
    mockedPost.mockResolvedValueOnce({
      data: { order: { code: "ABCD2345", items: [], subtotal: 3800, deliveryFee: 200, total: 4000 } },
    });
    renderPage();

    await screen.findByDisplayValue("Jane Doe");
    await userEvent.type(screen.getByLabelText(/^Phone \*$/), "712345678");
    await fillDeliveryAddressFields();
    await userEvent.click(screen.getByText("Save this address to my profile"));
    await userEvent.click(screen.getByRole("button", { name: /Place order/ }));

    // The order itself still succeeds and navigates — the write-back failure
    // is a non-blocking, best-effort second request.
    expect(await screen.findByText("Confirmation page")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Could not save this address to your profile, but your order was placed.",
      ),
    ).toBeInTheDocument();
  });
});
