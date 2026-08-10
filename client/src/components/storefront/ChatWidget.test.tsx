import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import ChatWidget from "./ChatWidget";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

function axios404() {
  return Object.assign(new Error("Not Found"), {
    isAxiosError: true,
    response: { status: 404, data: { error: "Inquiry not found" } },
  });
}

describe("storefront ChatWidget", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    mockedGet.mockReset();
    mockedPost.mockReset();
    await i18n.changeLanguage("en");
  });

  it("shows the start form when no inquiry is stored", async () => {
    renderWithQuery(<ChatWidget />);

    await userEvent.click(screen.getByRole("button", { name: "Open chat" }));

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start chat" })).toBeInTheDocument();
  });

  it("shows validation errors and does not submit an invalid start form", async () => {
    renderWithQuery(<ChatWidget />);
    await userEvent.click(screen.getByRole("button", { name: "Open chat" }));

    await userEvent.click(screen.getByRole("button", { name: "Start chat" }));

    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("starts a chat and switches to the thread view", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inquiry: { id: "inq1" } } });
    mockedGet.mockResolvedValue({
      data: { inquiry: { id: "inq1", status: "OPEN", messages: [] } },
    });
    renderWithQuery(<ChatWidget />);
    await userEvent.click(screen.getByRole("button", { name: "Open chat" }));

    await userEvent.type(screen.getByLabelText("Name"), "Jane Doe");
    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Phone"), "+255 700 111 222");
    await userEvent.type(screen.getByLabelText("Message"), "Do you have rice in stock?");
    await userEvent.click(screen.getByRole("button", { name: "Start chat" }));

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith("/api/storefront/inquiries/inq1"));
    expect(window.localStorage.getItem("es-market-inquiry-id")).toBe("inq1");
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/storefront/inquiries",
      expect.objectContaining({ language: "en" }),
    );
  });

  it("submits the active UI language with the inquiry", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inquiry: { id: "inq1" } } });
    mockedGet.mockResolvedValue({
      data: { inquiry: { id: "inq1", status: "OPEN", messages: [] } },
    });
    await i18n.changeLanguage("ar");
    renderWithQuery(<ChatWidget />);
    await userEvent.click(screen.getByRole("button", { name: "فتح المحادثة" }));

    await userEvent.type(screen.getByLabelText("الاسم"), "Jane Doe");
    await userEvent.type(screen.getByLabelText("البريد الإلكتروني"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("الهاتف"), "+255 700 111 222");
    await userEvent.type(screen.getByLabelText("الرسالة"), "Do you have rice in stock?");
    await userEvent.click(screen.getByRole("button", { name: "بدء المحادثة" }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith(
        "/api/storefront/inquiries",
        expect.objectContaining({ language: "ar" }),
      ),
    );
  });

  it("renders customer and staff messages with a reply box", async () => {
    window.localStorage.setItem("es-market-inquiry-id", "inq1");
    mockedGet.mockResolvedValue({
      data: {
        inquiry: {
          id: "inq1",
          status: "OPEN",
          messages: [
            { id: "m1", sender: "CUSTOMER", body: "Do you have rice?", createdAt: new Date().toISOString() },
            { id: "m2", sender: "STAFF", body: "Yes, in stock!", createdAt: new Date().toISOString() },
          ],
        },
      },
    });
    renderWithQuery(<ChatWidget />);

    await userEvent.click(screen.getByRole("button", { name: "Open chat" }));

    expect(await screen.findByText("Do you have rice?")).toBeInTheDocument();
    expect(screen.getByText("Yes, in stock!")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("hides the reply box when the conversation is closed", async () => {
    window.localStorage.setItem("es-market-inquiry-id", "inq1");
    mockedGet.mockResolvedValue({
      data: {
        inquiry: {
          id: "inq1",
          status: "CLOSED",
          messages: [
            { id: "m1", sender: "CUSTOMER", body: "Do you have rice?", createdAt: new Date().toISOString() },
          ],
        },
      },
    });
    renderWithQuery(<ChatWidget />);

    await userEvent.click(screen.getByRole("button", { name: "Open chat" }));

    expect(await screen.findByText("This conversation is closed.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });

  it("clears the stored id and falls back to the start form on a 404", async () => {
    window.localStorage.setItem("es-market-inquiry-id", "stale-id");
    mockedGet.mockRejectedValue(axios404());
    renderWithQuery(<ChatWidget />);

    await userEvent.click(screen.getByRole("button", { name: "Open chat" }));

    expect(await screen.findByRole("button", { name: "Start chat" })).toBeInTheDocument();
    expect(window.localStorage.getItem("es-market-inquiry-id")).toBeNull();
  });
});
