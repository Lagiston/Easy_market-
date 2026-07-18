import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { OrderStatus, FulfillmentType } from "@es-market/core";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import OrderStatusPage from "./OrderStatusPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);

const order = {
  code: "ABCD2345",
  status: OrderStatus.CONFIRMED,
  fulfillmentType: FulfillmentType.DELIVERY,
  createdAt: "2026-07-18T12:00:00.000Z",
  subtotal: 3000,
  deliveryFee: 200,
  total: 3200,
  items: [{ productName: { en: "Rice 5kg" }, unitPrice: 1500, quantity: 2 }],
};

async function submitLookup(code = "abcd2345", phone = "0712345678") {
  await userEvent.type(screen.getByLabelText("Order code"), code);
  await userEvent.type(screen.getByLabelText("Phone"), phone);
  await userEvent.click(screen.getByRole("button", { name: "Check status" }));
}

describe("storefront OrderStatusPage", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("looks up an order (uppercasing the code) and shows status, items, and totals", async () => {
    mockedGet.mockResolvedValueOnce({ data: { order } });
    renderWithQuery(<OrderStatusPage />);

    await submitLookup();

    expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith("/api/storefront/orders/lookup", {
      params: { code: "ABCD2345", phone: "0712345678" },
    });
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Rice 5kg × 2")).toBeInTheDocument();
    // 3000 appears as both the line total (1500×2) and the subtotal
    expect(screen.getAllByText("3000")).toHaveLength(2);
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("3200")).toBeInTheDocument();
  });

  it("shows validation errors when submitted empty", async () => {
    renderWithQuery(<OrderStatusPage />);

    await userEvent.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByText("Order code is required")).toBeInTheDocument();
    expect(screen.getByText("Phone number is required")).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("shows a not-found message for an unknown code/phone pair", async () => {
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedGet.mockRejectedValueOnce(
      new AxiosError("Not found", undefined, undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        data: { error: "Order not found" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithQuery(<OrderStatusPage />);

    await submitLookup();

    expect(
      await screen.findByText("No order found for this code and phone number."),
    ).toBeInTheDocument();
  });

  it("shows a generic error when the request fails", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network error"));
    renderWithQuery(<OrderStatusPage />);

    await submitLookup();

    expect(
      await screen.findByText("Could not check the order status. Please try again."),
    ).toBeInTheDocument();
  });
});
