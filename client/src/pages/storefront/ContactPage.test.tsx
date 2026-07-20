import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import ContactPage from "./ContactPage";

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

    expect(screen.getByRole("link", { name: "+255 700 000 000" })).toHaveAttribute(
      "href",
      "tel:+255700000000",
    );
    expect(screen.getByRole("link", { name: "hello@es-market.example" })).toHaveAttribute(
      "href",
      "mailto:hello@es-market.example",
    );
  });

  it("renders address and opening hours", () => {
    renderWithQuery(<ContactPage />);

    expect(screen.getByText("12 Market Street, City Center")).toBeInTheDocument();
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
    mockedPost.mockResolvedValueOnce({ data: { inquiry: { id: "inq1" } } });
    renderWithQuery(<ContactPage />);

    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Thanks — we'll get back to you soon.")).toBeInTheDocument();
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
    mockedPost.mockResolvedValueOnce({ data: { inquiry: { id: "inq1" } } });
    await i18n.changeLanguage("ar");
    renderWithQuery(<ContactPage />);

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
