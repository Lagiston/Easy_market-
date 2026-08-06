import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { InquiryStatus, MessageSender } from "@es-market/core";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import { getStoredInquiryId } from "@/lib/inquiry-session";
import InquiryStatusPage from "./InquiryStatusPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);

const inquiry = {
  id: "inq1",
  code: "ABCD2345",
  status: InquiryStatus.OPEN,
  messages: [
    {
      id: "m1",
      sender: MessageSender.CUSTOMER,
      body: "Do you have rice in stock?",
      createdAt: "2026-07-18T12:00:00.000Z",
    },
  ],
};

async function submitLookup(code = "abcd2345", email = "jane@example.com") {
  await userEvent.type(screen.getByLabelText("Reference code"), code);
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.click(screen.getByRole("button", { name: "Check status" }));
}

describe("storefront InquiryStatusPage", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("looks up an inquiry (uppercasing the code) and shows status and messages", async () => {
    mockedGet.mockResolvedValueOnce({ data: { inquiry } });
    renderWithQuery(<InquiryStatusPage />);

    await submitLookup();

    expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith("/api/storefront/inquiries/lookup", {
      params: { code: "ABCD2345", email: "jane@example.com" },
    });
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Do you have rice in stock?")).toBeInTheDocument();
    expect(getStoredInquiryId()).toBe("inq1");
  });

  it("shows validation errors when submitted empty", async () => {
    renderWithQuery(<InquiryStatusPage />);

    await userEvent.click(screen.getByRole("button", { name: "Check status" }));

    expect(await screen.findByText("Inquiry code is required")).toBeInTheDocument();
    expect(screen.getByText("A valid email is required")).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("shows a not-found message for an unknown code/email pair", async () => {
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedGet.mockRejectedValueOnce(
      new AxiosError("Not found", undefined, undefined, undefined, {
        status: 404,
        statusText: "Not Found",
        data: { error: "Inquiry not found" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderWithQuery(<InquiryStatusPage />);

    await submitLookup();

    expect(
      await screen.findByText("No message found for this code and email."),
    ).toBeInTheDocument();
  });

  it("shows a generic error when the request fails", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network error"));
    renderWithQuery(<InquiryStatusPage />);

    await submitLookup();

    expect(
      await screen.findByText("Could not check the message status. Please try again."),
    ).toBeInTheDocument();
  });
});
