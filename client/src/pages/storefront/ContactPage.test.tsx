import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import { Toaster } from "@/components/ui/sonner";
import ContactPage from "./ContactPage";

function renderPage() {
  renderWithQuery(
    <>
      <ContactPage />
      <Toaster />
    </>,
  );
}

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, post: vi.fn() },
  };
});
const mockedPost = vi.mocked(axios.post);

async function fillForm() {
  await userEvent.type(screen.getByLabelText("Name"), "Jane Doe");
  await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
  await userEvent.type(screen.getByLabelText("Message"), "Do you have rice in stock?");
}

describe("storefront ContactPage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    mockedPost.mockReset();
    await i18n.changeLanguage("en");
  });

  it("renders phone and email as actionable links", () => {
    renderWithQuery(<ContactPage />);

    expect(screen.getByRole("link", { name: "+255 700 123 456" })).toHaveAttribute(
      "href",
      "tel:+255700123456",
    );
    expect(screen.getByRole("link", { name: "hello@es-market.co.tz" })).toHaveAttribute(
      "href",
      "mailto:hello@es-market.co.tz",
    );
  });

  it("renders address as a directions link and opening hours as text", () => {
    renderWithQuery(<ContactPage />);

    expect(
      screen.getByRole("link", { name: "12 Market Street, City Center" }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=12%20Market%20Street%2C%20City%20Center",
    );
    expect(screen.getByText("Mon–Sat: 8:00–20:00, Sun: 9:00–14:00")).toBeInTheDocument();
  });

  it("renders translated labels in Arabic", async () => {
    await i18n.changeLanguage("ar");
    renderWithQuery(<ContactPage />);

    expect(screen.getByRole("heading", { name: "اتصل بنا" })).toBeInTheDocument();
    expect(screen.getAllByText("الهاتف").length).toBeGreaterThan(0);
    expect(screen.getByText("شارع السوق 12، وسط المدينة")).toBeInTheDocument();
  });

  it("shows validation errors and does not submit", async () => {
    renderWithQuery(<ContactPage />);

    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("A valid email is required")).toBeInTheDocument();
    expect(screen.getByText("Message must be at least 10 characters")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("submits the inquiry and shows a success message", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inquiry: { id: "inq1", code: "ABCD2345" } } });
    renderPage();

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Thanks — we'll get back to you soon.")).toBeInTheDocument();
    expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/storefront/inquiries",
      expect.objectContaining({
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        message: "Do you have rice in stock?",
        language: "en",
      }),
    );
  });

  it("submits the active UI language with the inquiry", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inquiry: { id: "inq1", code: "ABCD2345" } } });
    await i18n.changeLanguage("ar");
    renderPage();

    await userEvent.type(screen.getByLabelText("الاسم"), "Jane Doe");
    await userEvent.type(screen.getByLabelText("البريد الإلكتروني"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("الرسالة"), "Do you have rice in stock?");
    await userEvent.click(screen.getByRole("button", { name: "إرسال الرسالة" }));

    expect(await screen.findByText("شكرًا — سنتواصل معك قريبًا.")).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/storefront/inquiries",
      expect.objectContaining({ language: "ar" }),
    );
  });

  it("shows the server error when submission fails", async () => {
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedPost.mockRejectedValueOnce(
      new AxiosError("Bad Request", undefined, undefined, undefined, {
        status: 400,
        statusText: "Bad Request",
        data: { error: "A valid email is required" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithQuery(<ContactPage />);

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("A valid email is required")).toBeInTheDocument();
  });
});
