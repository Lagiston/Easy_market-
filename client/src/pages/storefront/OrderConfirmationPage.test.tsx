import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import i18n from "@/i18n";
import OrderConfirmationPage from "./OrderConfirmationPage";
import type { PlacedOrder } from "./CheckoutPage";

const order: PlacedOrder = {
  code: "ABCD2345",
  status: "RECEIVED",
  fulfillmentType: "DELIVERY",
  subtotal: 3800,
  deliveryFee: 200,
  total: 4000,
  items: [
    { productName: { en: "Rice 5kg" }, unitPrice: 1500, quantity: 2 },
    { productName: { en: "Sunflower Oil" }, unitPrice: 800, quantity: 1 },
  ],
};

function renderPage(state?: { order: PlacedOrder }) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/checkout/confirmation", state }]}>
      <Routes>
        <Route path="/checkout/confirmation" element={<OrderConfirmationPage />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("storefront OrderConfirmationPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows the order code, items, and totals", () => {
    renderPage({ order });

    expect(screen.getByText("ABCD2345")).toBeInTheDocument();
    expect(screen.getByText("Rice 5kg × 2")).toBeInTheDocument();
    expect(screen.getByText("3000")).toBeInTheDocument(); // 1500×2 line total
    expect(screen.getByText("3800")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("4000")).toBeInTheDocument();
    expect(
      screen.getByText("We'll call you shortly to confirm your order."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue shopping" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("shows the pickup note for pickup orders", () => {
    renderPage({ order: { ...order, fulfillmentType: "PICKUP", deliveryFee: 0, total: 3800 } });

    expect(
      screen.getByText("We'll call you shortly to confirm when your order is ready for pickup."),
    ).toBeInTheDocument();
  });

  it("redirects home when visited without an order", async () => {
    renderPage();

    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});
