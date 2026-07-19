import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import { CancelReason, FulfillmentType, OrderStatus } from "@es-market/core";
import type { OrderRow } from "@/components/OrdersTable";
import CancelOrderDialog from "./CancelOrderDialog";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
const mockedPost = vi.mocked(axios.post);

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "o1",
    code: "ABCD2345",
    status: OrderStatus.CONFIRMED,
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

describe("CancelOrderDialog", () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it("renders nothing when no order is set", () => {
    renderWithQuery(<CancelOrderDialog order={null} onOpenChange={() => {}} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires a reason before submitting", async () => {
    renderWithQuery(<CancelOrderDialog order={order()} onOpenChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(await screen.findByText("A cancel reason is required")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("cancels the order with the selected reason and closes", async () => {
    const onOpenChange = vi.fn();
    mockedPost.mockResolvedValueOnce({ data: { order: {} } });
    renderWithQuery(<CancelOrderDialog order={order()} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Outside delivery area" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/api/orders/o1/cancel", {
        reason: CancelReason.OUTSIDE_DELIVERY_AREA,
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("surfaces a server error when cancelling fails", async () => {
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedPost.mockRejectedValueOnce(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        data: { error: "Only received or confirmed orders can be cancelled" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithQuery(<CancelOrderDialog order={order()} onOpenChange={() => {}} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Customer request" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel order" }));

    expect(
      await screen.findByText("Only received or confirmed orders can be cancelled"),
    ).toBeInTheDocument();
  });
});
