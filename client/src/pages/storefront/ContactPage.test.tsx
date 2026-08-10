import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import { Toaster } from "@/components/ui/sonner";
import ContactPage from "./ContactPage";

function renderPage() {
  renderWithQuery(
    <MemoryRouter>
      <ContactPage />
      <Toaster />
    </MemoryRouter>,
  );
}

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

const contactSettings = {
  deliveryFee: 0,
  freeDeliveryThreshold: null,
  contactPhone: "+255 700 123 456",
  contactEmail: "hello@es-market.co.tz",
  contactAddress: "12 Market Street, City Center",
};

async function fillRequiredFields() {
  await userEvent.click(screen.getByRole("combobox", { name: /what's this about/i }));
  await userEvent.click(await screen.findByRole("option", { name: "Product question" }));
  await userEvent.type(screen.getByLabelText(/^Name/), "Jane Doe");
  await userEvent.type(screen.getByLabelText(/^Phone/), "+255 700 111 222");
  await userEvent.type(screen.getByLabelText(/^Message/), "Do you have rice in stock?");
}

describe("storefront ContactPage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: { settings: contactSettings } });
    mockedPost.mockReset();
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders phone and email as actionable links", async () => {
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    expect(
      await screen.findByRole("link", { name: /\+255 700 123 456/ }),
    ).toHaveAttribute("href", "tel:+255700123456");
    expect(screen.getByRole("link", { name: /hello@es-market.co.tz/ })).toHaveAttribute(
      "href",
      "mailto:hello@es-market.co.tz",
    );
  });

  it("renders address as a directions link and a map", async () => {
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    expect(
      await screen.findByRole("link", { name: /12 Market Street, City Center/ }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=12%20Market%20Street%2C%20City%20Center",
    );
    expect(screen.getByTitle("Store & pickup")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get directions/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=12%20Market%20Street%2C%20City%20Center",
    );
  });

  it("renders the WhatsApp and call CTAs from the configured phone", async () => {
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    expect(await screen.findByRole("link", { name: /Chat on WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/255700123456",
    );
    expect(screen.getByRole("link", { name: /Call us/ })).toHaveAttribute(
      "href",
      "tel:+255700123456",
    );
  });

  it("hides contact rows and CTAs that haven't been configured", async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      data: {
        settings: {
          deliveryFee: 0,
          freeDeliveryThreshold: null,
          contactPhone: null,
          contactEmail: null,
          contactAddress: null,
        },
      },
    });
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Contact us" });
    expect(screen.queryByRole("link", { name: /Chat on WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Call us/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Store & pickup")).not.toBeInTheDocument();
  });

  it("renders translated labels in Arabic", async () => {
    await i18n.changeLanguage("ar");
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "اتصل بنا" })).toBeInTheDocument();
    expect(await screen.findByText("12 Market Street, City Center")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /الدردشة عبر واتساب/ })).toBeInTheDocument();
  });

  it("shows the open-now status during business hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10, 12, 0)); // Monday, 12:00 (within 8:00–20:00)
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    expect(screen.getByText(/Open now/)).toBeInTheDocument();
  });

  it("shows the closed status outside business hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10, 22, 0)); // Monday, 22:00 (after close)
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    expect(screen.getByText(/Closed/)).toBeInTheDocument();
  });

  it("shows validation errors for topic, name, phone, and message but not email", async () => {
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Select what this is about")).toBeInTheDocument();
    expect(screen.getByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("A valid phone number is required")).toBeInTheDocument();
    expect(screen.getByText("Message must be at least 10 characters")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("submits with only the required fields (no email) and shows the success state", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inquiry: { id: "inq1", code: "ABCD2345" } } });
    renderPage();

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Message sent")).toBeInTheDocument();
    expect(screen.getByText("ABCD2345")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track this message" })).toHaveAttribute(
      "href",
      "/track",
    );
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/storefront/inquiries",
      expect.objectContaining({
        topic: "PRODUCT_QUESTION",
        customerName: "Jane Doe",
        customerPhone: "+255 700 111 222",
        message: "Do you have rice in stock?",
        language: "en",
      }),
    );
  });

  it("validates a filled-in email as a real address", async () => {
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    await fillRequiredFields();
    await userEvent.type(screen.getByLabelText(/^Email/), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("A valid email is required")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("shows the server error when submission fails", async () => {
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedPost.mockRejectedValueOnce(
      new AxiosError("Bad Request", undefined, undefined, undefined, {
        status: 400,
        statusText: "Bad Request",
        data: { error: "A valid phone number is required" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithQuery(<MemoryRouter><ContactPage /></MemoryRouter>);

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("A valid phone number is required")).toBeInTheDocument();
  });
});
