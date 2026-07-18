import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import { CancelReason, FulfillmentType, OrderStatus } from "@es-market/core";
import type { OrderRow } from "@/components/OrdersTable";
import OrdersPage from "./OrdersPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "o1",
    code: "ABCD2345",
    status: OrderStatus.RECEIVED,
    fulfillmentType: FulfillmentType.DELIVERY,
    customerName: "Jane Doe",
    customerPhone: "0712345678",
    address: "12 Main St",
    deliveryFee: 200,
    cancelReason: null,
    callAttempts: 0,
    createdAt: "2026-07-18T12:00:00.000Z",
    subtotal: 3800,
    total: 4000,
    items: [{ id: "i1", productName: { en: "Rice 5kg" }, unitPrice: 1900, quantity: 2 }],
    ...overrides,
  };
}

describe("OrdersPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("renders order rows with code, customer, status, calls, and total", async () => {
    mockedGet.mockResolvedValueOnce({ data: { orders: [order()] } });
    renderWithQuery(<OrdersPage />);

    expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("0712345678")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("4000")).toBeInTheDocument();
    expect(screen.getByText("1 order — call the customer to confirm each received order.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no orders", async () => {
    mockedGet.mockResolvedValueOnce({ data: { orders: [] } });
    renderWithQuery(<OrdersPage />);

    expect(await screen.findByText("No orders yet.")).toBeInTheDocument();
  });

  it("only offers actions on received orders", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        orders: [
          order(),
          order({ id: "o2", code: "WXYZ6789", status: OrderStatus.CONFIRMED }),
          order({ id: "o3", code: "QRST4567", status: OrderStatus.CANCELLED, cancelReason: CancelReason.CUSTOMER_REQUEST }),
        ],
      },
    });
    renderWithQuery(<OrdersPage />);

    expect(await screen.findByLabelText("Log failed call for ABCD2345")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm order ABCD2345")).toBeInTheDocument();
    expect(screen.queryByLabelText("Log failed call for WXYZ6789")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm order WXYZ6789")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Log failed call for QRST4567")).not.toBeInTheDocument();
  });

  it("hides the cancel action below three call attempts and shows it at three", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        orders: [
          order({ id: "o1", code: "ABCD2345", callAttempts: 2 }),
          order({ id: "o2", code: "WXYZ6789", callAttempts: 3 }),
        ],
      },
    });
    renderWithQuery(<OrdersPage />);

    expect(await screen.findByLabelText("Cancel unreachable order WXYZ6789")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cancel unreachable order ABCD2345")).not.toBeInTheDocument();
  });

  it("logs a failed call and refetches", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { orders: [order()] } })
      .mockResolvedValueOnce({ data: { orders: [order({ callAttempts: 1 })] } });
    mockedPost.mockResolvedValueOnce({ data: { order: order({ callAttempts: 1 }) } });
    renderWithQuery(<OrdersPage />);

    await userEvent.click(await screen.findByLabelText("Log failed call for ABCD2345"));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/call-attempt");
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
  });

  it("confirms an order", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { orders: [order()] } })
      .mockResolvedValueOnce({ data: { orders: [order({ status: OrderStatus.CONFIRMED })] } });
    mockedPost.mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.CONFIRMED }) } });
    renderWithQuery(<OrdersPage />);

    await userEvent.click(await screen.findByLabelText("Confirm order ABCD2345"));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/confirm");
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
  });

  it("cancels an unreachable order through the confirm dialog", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { orders: [order({ callAttempts: 3 })] } })
      .mockResolvedValueOnce({
        data: { orders: [order({ status: OrderStatus.CANCELLED, cancelReason: CancelReason.CUSTOMER_UNREACHABLE, callAttempts: 3 })] },
      });
    mockedPost.mockResolvedValueOnce({ data: { order: {} } });
    renderWithQuery(<OrdersPage />);

    await userEvent.click(await screen.findByLabelText("Cancel unreachable order ABCD2345"));
    expect(await screen.findByText("Cancel order ABCD2345?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/cancel", {
      reason: CancelReason.CUSTOMER_UNREACHABLE,
    });
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });

  it("surfaces a server error when an action fails", async () => {
    mockedGet.mockResolvedValue({ data: { orders: [order()] } });
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedPost.mockRejectedValueOnce(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        data: { error: "Only received orders can be confirmed" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithQuery(<OrdersPage />);

    await userEvent.click(await screen.findByLabelText("Confirm order ABCD2345"));

    expect(await screen.findByText("Only received orders can be confirmed")).toBeInTheDocument();
  });
});
