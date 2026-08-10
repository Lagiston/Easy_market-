import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter, Route, Routes } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import { CancelReason, FulfillmentType, OrderStatus } from "@es-market/core";
import type { OrderRow } from "@/components/OrdersTable";
import OrderDetailPage from "./OrderDetailPage";

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
    callAttempts: 2,
    createdAt: "2026-07-18T12:00:00.000Z",
    updatedAt: "2026-07-18T13:00:00.000Z",
    subtotal: 3800,
    total: 4000,
    items: [{ id: "i1", productName: { en: "Rice 5kg" }, unitPrice: 1900, quantity: 2 }],
    ...overrides,
  };
}

function renderPage() {
  renderWithQuery(
    <MemoryRouter initialEntries={["/admin/orders/o1"]}>
      <Routes>
        <Route path="/admin/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OrderDetailPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("fetches the order by id and renders customer, items, and totals", async () => {
    mockedGet.mockResolvedValueOnce({ data: { order: order() } });
    renderPage();

    expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith("/api/orders/o1");
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("0712345678")).toBeInTheDocument();
    expect(screen.getByText("12 Main St")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("Rice 5kg")).toBeInTheDocument();
    // 3800 is both the line total and the subtotal.
    expect(screen.getAllByText("3,800")).toHaveLength(2);
    expect(screen.getByText("4,000")).toBeInTheDocument();
  });

  it("shows SMS notification history when the detail route includes it", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        order: order({
          smsLogs: [
            {
              id: "sms1",
              to: "+255712345678",
              message: "Halatu: order ABCD2345 confirmed. Total TSh 4000, pay on delivery.",
              status: "SENT",
              error: null,
              createdAt: "2026-07-18T13:00:00.000Z",
            },
          ],
        }),
      },
    });
    renderPage();

    await screen.findByText("ABCD2345");
    expect(screen.getByText("SMS notifications")).toBeInTheDocument();
    expect(
      screen.getByText("Halatu: order ABCD2345 confirmed. Total TSh 4000, pay on delivery."),
    ).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("shows the cancel reason on a cancelled order and offers no actions", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        order: order({
          status: OrderStatus.CANCELLED,
          cancelReason: CancelReason.OUTSIDE_DELIVERY_AREA,
        }),
      },
    });
    renderPage();

    expect(await screen.findByText("Outside delivery area")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete order" })).not.toBeInTheDocument();
  });

  it("renders a not-found state on 404", async () => {
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
    renderPage();

    expect(await screen.findByText("Order not found.")).toBeInTheDocument();
  });

  it("confirms a received order and refetches", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { order: order() } })
      .mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.CONFIRMED }) } });
    mockedPost.mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.CONFIRMED }) } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Confirm order" }));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/confirm");
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
  });

  it("marks a confirmed delivery order out for delivery", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.CONFIRMED }) } })
      .mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.OUT_FOR_DELIVERY }) } });
    mockedPost.mockResolvedValueOnce({
      data: { order: order({ status: OrderStatus.OUT_FOR_DELIVERY }) },
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Mark out for delivery" }),
    );

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/out-for-delivery");
    expect(await screen.findByText("Out for delivery")).toBeInTheDocument();
  });

  it("does not show the delay notice button for a just-received order", async () => {
    mockedGet.mockResolvedValueOnce({ data: { order: order() } });
    renderPage();

    await screen.findByText("Received");
    expect(
      screen.queryByRole("button", { name: "Notify customer of delay" }),
    ).not.toBeInTheDocument();
  });

  it("sends a delayed notice for a confirmed order without changing its status", async () => {
    mockedGet.mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.CONFIRMED }) } });
    mockedPost.mockResolvedValueOnce({ data: { sent: true } });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Notify customer of delay" }),
    );

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/notify-delayed");
    expect(await screen.findByText("Delayed notice sent.")).toBeInTheDocument();
  });

  it("completes a confirmed pickup order", async () => {
    mockedGet
      .mockResolvedValueOnce({
        data: {
          order: order({
            status: OrderStatus.CONFIRMED,
            fulfillmentType: FulfillmentType.PICKUP,
          }),
        },
      })
      .mockResolvedValueOnce({
        data: {
          order: order({
            status: OrderStatus.COMPLETED,
            fulfillmentType: FulfillmentType.PICKUP,
          }),
        },
      });
    mockedPost.mockResolvedValueOnce({ data: { order: {} } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Complete order" }));

    expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/complete");
    expect(await screen.findByText("Completed")).toBeInTheDocument();
  });

  it("cancels the order with a reason through the cancel dialog", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { order: order({ status: OrderStatus.CONFIRMED }) } })
      .mockResolvedValueOnce({
        data: {
          order: order({
            status: OrderStatus.CANCELLED,
            cancelReason: CancelReason.CUSTOMER_REQUEST,
          }),
        },
      });
    mockedPost.mockResolvedValueOnce({ data: { order: {} } });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Cancel order" }));
    expect(await screen.findByText("Cancel order ABCD2345?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Customer request" }));
    await userEvent.click(
      screen.getByRole("dialog").querySelector("button[type=submit]") as HTMLElement,
    );

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/cancel", {
        reason: CancelReason.CUSTOMER_REQUEST,
      }),
    );
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });

  it("surfaces a server error when an action fails", async () => {
    mockedGet.mockResolvedValue({ data: { order: order() } });
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

    await userEvent.click(await screen.findByRole("button", { name: "Confirm order" }));

    expect(await screen.findByText("Only received orders can be confirmed")).toBeInTheDocument();
  });
});
