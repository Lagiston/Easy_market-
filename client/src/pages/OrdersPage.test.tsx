import "@/i18n";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
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
    updatedAt: "2026-07-18T12:00:00.000Z",
    subtotal: 3800,
    total: 4000,
    items: [{ id: "i1", productName: { en: "Rice 5kg" }, unitPrice: 1900, quantity: 2 }],
    ...overrides,
  };
}

function renderPage(initialEntries: string[] = ["/"]) {
  return renderWithQuery(
    <MemoryRouter initialEntries={initialEntries}>
      <OrdersPage />
    </MemoryRouter>,
  );
}

describe("OrdersPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("renders order rows with code, customer, status, calls, and total", async () => {
    mockedGet.mockResolvedValueOnce({ data: { orders: [order()] } });
    renderPage();

    expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("0712345678")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("4000")).toBeInTheDocument();
    expect(screen.getByText("1 order — call the customer to confirm each received order.")).toBeInTheDocument();
  });

  it("links each order code to its detail page", async () => {
    mockedGet.mockResolvedValueOnce({ data: { orders: [order()] } });
    renderPage();

    expect(await screen.findByRole("link", { name: "ABCD2345" })).toHaveAttribute(
      "href",
      "/admin/orders/o1",
    );
  });

  it("shows an empty state when there are no orders", async () => {
    mockedGet.mockResolvedValueOnce({ data: { orders: [] } });
    renderPage();

    expect(await screen.findByText("No orders yet.")).toBeInTheDocument();
  });

  it("fetches all orders by default and refetches with a status filter on tab click", async () => {
    mockedGet.mockResolvedValue({ data: { orders: [] } });
    renderPage();

    await screen.findByText("No orders yet.");
    expect(mockedGet).toHaveBeenCalledWith("/api/orders", { params: {} });

    await userEvent.click(screen.getByRole("tab", { name: "Confirmed" }));

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith("/api/orders", {
        params: { status: OrderStatus.CONFIRMED },
      }),
    );
  });

  it("pre-filters by status from an incoming ?status= query param (dashboard deep link)", async () => {
    mockedGet.mockResolvedValue({ data: { orders: [] } });
    renderPage(["/?status=RECEIVED"]);

    await screen.findByText("No orders yet.");
    expect(mockedGet).toHaveBeenCalledWith("/api/orders", {
      params: { status: OrderStatus.RECEIVED },
    });
    expect(screen.getByRole("tab", { name: "Received" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("ignores an invalid ?status= query param and falls back to all orders", async () => {
    mockedGet.mockResolvedValue({ data: { orders: [] } });
    renderPage(["/?status=NOT_A_REAL_STATUS"]);

    await screen.findByText("No orders yet.");
    expect(mockedGet).toHaveBeenCalledWith("/api/orders", { params: {} });
  });

  it("offers phone actions only on received orders", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        orders: [
          order(),
          order({ id: "o2", code: "WXYZ6789", status: OrderStatus.CONFIRMED }),
          order({ id: "o3", code: "QRST4567", status: OrderStatus.CANCELLED, cancelReason: CancelReason.CUSTOMER_REQUEST }),
        ],
      },
    });
    renderPage();

    expect(await screen.findByLabelText("Log failed call for ABCD2345")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm order ABCD2345")).toBeInTheDocument();
    expect(screen.queryByLabelText("Log failed call for WXYZ6789")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm order WXYZ6789")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Log failed call for QRST4567")).not.toBeInTheDocument();
  });

  it("hides the unreachable-cancel action below three call attempts and shows it at three", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        orders: [
          order({ id: "o1", code: "ABCD2345", callAttempts: 2 }),
          order({ id: "o2", code: "WXYZ6789", callAttempts: 3 }),
        ],
      },
    });
    renderPage();

    expect(await screen.findByLabelText("Cancel unreachable order WXYZ6789")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cancel unreachable order ABCD2345")).not.toBeInTheDocument();
  });

  it("logs a failed call and refetches", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { orders: [order()] } })
      .mockResolvedValueOnce({ data: { orders: [order({ callAttempts: 1 })] } });
    mockedPost.mockResolvedValueOnce({ data: { order: order({ callAttempts: 1 }) } });
    renderPage();

    await userEvent.click(await screen.findByLabelText("Log failed call for ABCD2345"));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/call-attempt");
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
  });

  it("confirms an order", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { orders: [order()] } })
      .mockResolvedValueOnce({ data: { orders: [order({ status: OrderStatus.CONFIRMED })] } });
    mockedPost.mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.CONFIRMED }) } });
    renderPage();

    await userEvent.click(await screen.findByLabelText("Confirm order ABCD2345"));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/confirm");
    expect(await within(screen.getByRole("table")).findByText("Confirmed")).toBeInTheDocument();
  });

  it("marks a confirmed delivery order out for delivery", async () => {
    mockedGet
      .mockResolvedValueOnce({
        data: { orders: [order({ status: OrderStatus.CONFIRMED })] },
      })
      .mockResolvedValueOnce({
        data: { orders: [order({ status: OrderStatus.OUT_FOR_DELIVERY })] },
      });
    mockedPost.mockResolvedValueOnce({
      data: { order: order({ status: OrderStatus.OUT_FOR_DELIVERY }) },
    });
    renderPage();

    await userEvent.click(
      await screen.findByLabelText("Mark order ABCD2345 out for delivery"),
    );

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/out-for-delivery");
    expect(await within(screen.getByRole("table")).findByText("Out for delivery")).toBeInTheDocument();
  });

  it("offers complete on dispatched delivery orders and confirmed pickup orders only", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        orders: [
          order({ id: "o1", code: "ABCD2345", status: OrderStatus.OUT_FOR_DELIVERY }),
          order({
            id: "o2",
            code: "WXYZ6789",
            status: OrderStatus.CONFIRMED,
            fulfillmentType: FulfillmentType.PICKUP,
          }),
          order({ id: "o3", code: "QRST4567", status: OrderStatus.CONFIRMED }),
        ],
      },
    });
    renderPage();

    expect(await screen.findByLabelText("Complete order ABCD2345")).toBeInTheDocument();
    expect(screen.getByLabelText("Complete order WXYZ6789")).toBeInTheDocument();
    // A confirmed delivery order must be dispatched first.
    expect(screen.queryByLabelText("Complete order QRST4567")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mark order QRST4567 out for delivery")).toBeInTheDocument();
    expect(screen.queryByLabelText("Mark order WXYZ6789 out for delivery")).not.toBeInTheDocument();
  });

  it("completes an order", async () => {
    mockedGet
      .mockResolvedValueOnce({
        data: { orders: [order({ status: OrderStatus.OUT_FOR_DELIVERY })] },
      })
      .mockResolvedValueOnce({
        data: { orders: [order({ status: OrderStatus.COMPLETED })] },
      });
    mockedPost.mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.COMPLETED }) } });
    renderPage();

    await userEvent.click(await screen.findByLabelText("Complete order ABCD2345"));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/complete");
    expect(await within(screen.getByRole("table")).findByText("Completed")).toBeInTheDocument();
  });

  it("offers the general cancel on received and confirmed orders only", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        orders: [
          order({ id: "o1", code: "ABCD2345" }),
          order({ id: "o2", code: "WXYZ6789", status: OrderStatus.CONFIRMED }),
          order({ id: "o3", code: "QRST4567", status: OrderStatus.OUT_FOR_DELIVERY }),
          order({ id: "o4", code: "JKLM2345", status: OrderStatus.COMPLETED }),
        ],
      },
    });
    renderPage();

    expect(await screen.findByLabelText("Cancel order ABCD2345")).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel order WXYZ6789")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cancel order QRST4567")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cancel order JKLM2345")).not.toBeInTheDocument();
  });

  it("cancels an order with a chosen reason through the cancel dialog", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { orders: [order({ status: OrderStatus.CONFIRMED })] } })
      .mockResolvedValueOnce({
        data: {
          orders: [
            order({ status: OrderStatus.CANCELLED, cancelReason: CancelReason.CUSTOMER_REQUEST }),
          ],
        },
      });
    mockedPost.mockResolvedValueOnce({ data: { order: {} } });
    renderPage();

    await userEvent.click(await screen.findByLabelText("Cancel order ABCD2345"));
    expect(await screen.findByText("Cancel order ABCD2345?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Customer request" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/cancel", {
      reason: CancelReason.CUSTOMER_REQUEST,
    });
    expect(await within(screen.getByRole("table")).findByText("Cancelled")).toBeInTheDocument();
  });

  it("cancels an unreachable order through the confirm dialog", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { orders: [order({ callAttempts: 3 })] } })
      .mockResolvedValueOnce({
        data: { orders: [order({ status: OrderStatus.CANCELLED, cancelReason: CancelReason.CUSTOMER_UNREACHABLE, callAttempts: 3 })] },
      });
    mockedPost.mockResolvedValueOnce({ data: { order: {} } });
    renderPage();

    await userEvent.click(await screen.findByLabelText("Cancel unreachable order ABCD2345"));
    expect(await screen.findByText("Cancel order ABCD2345?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/cancel", {
      reason: CancelReason.CUSTOMER_UNREACHABLE,
    });
    expect(await within(screen.getByRole("table")).findByText("Cancelled")).toBeInTheDocument();
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
    renderPage();

    await userEvent.click(await screen.findByLabelText("Confirm order ABCD2345"));

    expect(await screen.findByText("Only received orders can be confirmed")).toBeInTheDocument();
  });
});
