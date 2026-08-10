import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { OrderStatus, FulfillmentType, InquiryStatus, MessageSender } from "@es-market/core";
import i18n from "@/i18n";
import TrackPage from "./TrackPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);

const deliveryOrder = {
  code: "ABCD2345",
  status: OrderStatus.CONFIRMED,
  fulfillmentType: FulfillmentType.DELIVERY,
  customerName: "Jane Doe",
  address: "12 Market Street, City Center",
  createdAt: "2026-07-18T12:00:00.000Z",
  updatedAt: "2026-07-18T12:30:00.000Z",
  subtotal: 3000,
  deliveryFee: 200,
  total: 3200,
  items: [
    {
      productName: { en: "Rice 5kg" },
      unitPrice: 1500,
      quantity: 2,
      imageUrl: "/api/uploads/products/rice.jpg",
    },
  ],
};

const openInquiry = {
  id: "inq1",
  code: "MSG4K2P9",
  status: InquiryStatus.OPEN,
  customerName: "Jane Doe",
  createdAt: "2026-07-18T12:00:00.000Z",
  assigned: false,
  messages: [
    {
      id: "m1",
      sender: MessageSender.CUSTOMER,
      body: "Where is my order?",
      createdAt: "2026-07-18T12:00:00.000Z",
    },
  ],
};

function renderTrackPage(initialEntry = "/track") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/track" element={<TrackPage />} />
          <Route path="/t/:code" element={<TrackPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function switchToMessageMode() {
  await userEvent.click(screen.getByRole("button", { name: "My message" }));
}

async function submitLookup(code: string, phone = "0712345678") {
  await userEvent.type(screen.getByLabelText(/code$/i), code);
  await userEvent.type(screen.getByLabelText("Phone number"), phone);
  await userEvent.click(screen.getByRole("button", { name: "Check status" }));
}

describe("storefront TrackPage", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    window.localStorage.clear();
    delete window.HalatuChat;
    await i18n.changeLanguage("en");
  });

  it("defaults to order mode", () => {
    renderTrackPage();

    expect(screen.getByRole("button", { name: "My order" })).toHaveClass("bg-white");
    expect(screen.getByLabelText("Order code")).toBeInTheDocument();
  });

  it("looks up an order and shows the header, timeline, items, and totals", async () => {
    mockedGet.mockResolvedValueOnce({ data: { order: deliveryOrder } });
    renderTrackPage();

    await submitLookup("abcd2345");

    expect(mockedGet).toHaveBeenCalledWith("/api/storefront/orders/lookup", {
      params: { code: "ABCD2345", phone: "0712345678" },
    });
    expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText("Confirmed by phone")).toBeInTheDocument();
    expect(screen.getByText("Out for delivery")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("3200")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Track something else" })).toBeInTheDocument();
  });

  it("switches to message mode, changing the label and placeholder", async () => {
    renderTrackPage();

    await switchToMessageMode();

    expect(screen.getByLabelText("Message code")).toHaveAttribute("placeholder", "MSG4K2P9");
    expect(screen.getByRole("button", { name: "My message" })).toHaveClass("bg-white");
  });

  it("hides the mode toggle while a result is shown, and returning to the form via Track something else brings it back", async () => {
    mockedGet.mockResolvedValueOnce({ data: { order: deliveryOrder } });
    renderTrackPage();

    await submitLookup("abcd2345");
    await screen.findByText("ABCD2345");

    expect(screen.queryByRole("button", { name: "My message" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Track something else" }));

    expect(screen.queryByText("ABCD2345")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My message" })).toBeInTheDocument();
  });

  it("looks up a message and shows the header, timeline, and chat bubbles", async () => {
    mockedGet.mockResolvedValueOnce({ data: { inquiry: openInquiry } });
    renderTrackPage();

    await switchToMessageMode();
    await submitLookup("msg4k2p9");

    expect(mockedGet).toHaveBeenCalledWith("/api/storefront/inquiries/lookup", {
      params: { code: "MSG4K2P9", phone: "0712345678" },
    });
    expect(await screen.findByText("MSG4K2P9")).toBeInTheDocument();
    expect(screen.getByText("Message received")).toBeInTheDocument();
    expect(screen.getByText("Assigned to the team")).toBeInTheDocument();
    expect(screen.getByText("Replied — waiting on you")).toBeInTheDocument();
    expect(screen.getByText("Where is my order?")).toBeInTheDocument();
    expect(screen.getByText(/^You/)).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("shows the staff reply on the right, labeled Halatu", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        inquiry: {
          ...openInquiry,
          status: InquiryStatus.RESOLVED,
          assigned: true,
          messages: [
            ...openInquiry.messages,
            {
              id: "m2",
              sender: MessageSender.STAFF,
              body: "It's on the way!",
              createdAt: "2026-07-18T13:00:00.000Z",
            },
          ],
        },
      },
    });
    renderTrackPage();

    await switchToMessageMode();
    await submitLookup("msg4k2p9");

    expect(await screen.findByText("It's on the way!")).toBeInTheDocument();
    expect(screen.getByText(/^Halatu/)).toBeInTheDocument();
    expect(screen.getAllByText("Replied").length).toBeGreaterThan(0);
  });

  it("shows a mode-specific error when the order code is too short", async () => {
    renderTrackPage();

    await userEvent.type(screen.getByLabelText("Order code"), "ABC1");
    await userEvent.type(screen.getByLabelText("Phone number"), "0712345678");
    await userEvent.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByText("We couldn't find that order")).toBeInTheDocument();
    expect(
      screen.getByText("Order codes are 8 characters — check the SMS we sent you."),
    ).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("shows a mode-specific error when the message code is too short", async () => {
    renderTrackPage();

    await switchToMessageMode();
    await userEvent.type(screen.getByLabelText("Message code"), "MSG1");
    await userEvent.type(screen.getByLabelText("Phone number"), "0712345678");
    await userEvent.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByText("We couldn't find that message")).toBeInTheDocument();
    expect(
      screen.getByText("Message codes are 8 characters — check the SMS we sent you."),
    ).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("shows the no-match message for an unknown order code/phone pair", async () => {
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
    renderTrackPage();

    await submitLookup("abcd2345");

    expect(await screen.findByText("We couldn't find that order")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No order matches that code and phone number. Double-check both, or start a chat with us.",
      ),
    ).toBeInTheDocument();
  });

  it("resets to the form on Track something else", async () => {
    mockedGet.mockResolvedValueOnce({ data: { order: deliveryOrder } });
    renderTrackPage();

    await submitLookup("abcd2345");
    await screen.findByText("ABCD2345");

    await userEvent.click(screen.getByRole("button", { name: "Track something else" }));

    expect(screen.getByLabelText("Order code")).toHaveValue("");
    expect(screen.queryByText("ABCD2345")).not.toBeInTheDocument();
  });

  it("opens the chat widget from the fallback link without navigating", async () => {
    const open = vi.fn();
    window.HalatuChat = { open };
    renderTrackPage();

    await userEvent.click(screen.getByRole("link", { name: "Chat with us" }));

    expect(open).toHaveBeenCalledTimes(1);
  });

  describe("deep links", () => {
    it("prefills the code and detects order mode from a /t/:code path", () => {
      renderTrackPage("/t/9TWMY5ZN");

      expect(screen.getByRole("button", { name: "My order" })).toHaveClass("bg-white");
      expect(screen.getByLabelText("Order code")).toHaveValue("9TWMY5ZN");
      expect(screen.getByLabelText("Phone number")).toHaveFocus();
    });

    it("prefills the code and detects message mode for an MSG-prefixed /t/:code path", () => {
      renderTrackPage("/t/MSG4K2P9");

      expect(screen.getByRole("button", { name: "My message" })).toHaveClass("bg-white");
      expect(screen.getByLabelText("Message code")).toHaveValue("MSG4K2P9");
      expect(screen.getByLabelText("Phone number")).toHaveFocus();
    });

    it("prefills and uppercases the code from a ?code= query param", () => {
      renderTrackPage("/track?code=9twmy5zn");

      expect(screen.getByLabelText("Order code")).toHaveValue("9TWMY5ZN");
    });

    it("shows the confirm-phone subtitle instead of the mode subtitle when deep-linked", () => {
      renderTrackPage("/t/9TWMY5ZN");

      expect(
        screen.getByText("Confirm your phone number to see the latest status."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Check where your order is — enter your order code and phone number."),
      ).not.toBeInTheDocument();
    });

    it("does not auto-submit or fetch anything just from arriving via a deep link", () => {
      renderTrackPage("/t/9TWMY5ZN");

      expect(mockedGet).not.toHaveBeenCalled();
      expect(screen.queryByText("ABCD2345")).not.toBeInTheDocument();
    });

    it("still requires the phone field before a deep-linked lookup succeeds", async () => {
      renderTrackPage("/t/9TWMY5ZN");

      await userEvent.click(screen.getByRole("button", { name: "Check status" }));

      expect(await screen.findByText("We couldn't find that order")).toBeInTheDocument();
      expect(mockedGet).not.toHaveBeenCalled();
    });
  });
});
