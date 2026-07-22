import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import i18n from "@/i18n";
import AccountOrdersPage from "./AccountOrdersPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const orders = [
  {
    code: "ABC12345",
    status: "RECEIVED",
    fulfillmentType: "PICKUP",
    createdAt: "2026-07-20T10:00:00.000Z",
    subtotal: 1500,
    deliveryFee: 0,
    total: 1500,
    items: [{ productName: { en: "Rice 5kg" }, unitPrice: 1500, quantity: 1 }],
  },
];

describe("AccountOrdersPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  it("renders the customer's orders", async () => {
    mockedAxios.get.mockResolvedValue({ data: { orders } });
    renderWithQuery(<AccountOrdersPage />);

    expect(await screen.findByText("ABC12345")).toBeInTheDocument();
    expect(screen.getByText(/Rice 5kg/)).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/customer/orders");
  });

  it("shows an empty state when there are no orders", async () => {
    mockedAxios.get.mockResolvedValue({ data: { orders: [] } });
    renderWithQuery(<AccountOrdersPage />);

    expect(await screen.findByText("You haven't placed any orders yet.")).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("network"));
    renderWithQuery(<AccountOrdersPage />);

    expect(
      await screen.findByText("Could not load your orders. Please try again."),
    ).toBeInTheDocument();
  });

  it("links guest orders by phone and refetches the list", async () => {
    const user = userEvent.setup();
    mockedAxios.get.mockResolvedValue({ data: { orders: [] } });
    mockedAxios.post.mockResolvedValue({ data: { linkedCount: 2 } });
    renderWithQuery(<AccountOrdersPage />);
    await screen.findByText("You haven't placed any orders yet.");

    await user.type(
      screen.getByLabelText("Ordered as a guest before? Enter that phone number to link it"),
      "0712345678",
    );
    await user.click(screen.getByRole("button", { name: "Link orders" }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/customer/orders/link-by-phone", {
        phone: "0712345678",
      });
    });
    expect(await screen.findByText("Linked 2 orders to your account.")).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("shows a no-match message when nothing was linked", async () => {
    const user = userEvent.setup();
    mockedAxios.get.mockResolvedValue({ data: { orders: [] } });
    mockedAxios.post.mockResolvedValue({ data: { linkedCount: 0 } });
    renderWithQuery(<AccountOrdersPage />);
    await screen.findByText("You haven't placed any orders yet.");

    await user.type(
      screen.getByLabelText("Ordered as a guest before? Enter that phone number to link it"),
      "0700000000",
    );
    await user.click(screen.getByRole("button", { name: "Link orders" }));

    expect(
      await screen.findByText("No unclaimed orders found for that phone number."),
    ).toBeInTheDocument();
  });
});
