import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter, Route, Routes } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import { InquiryStatus, Role } from "@es-market/core";
import InquiryDetailPage from "./InquiryDetailPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

type Overrides = {
  status?: InquiryStatus;
  language?: "en" | "ar" | "sw" | "fr";
  assignedAgent?: { id: string; name: string } | null;
  escalatedAt?: string | null;
  messages?: {
    id: string;
    sender: "CUSTOMER" | "STAFF";
    body: string;
    createdAt: string;
    author: { id: string; name: string } | null;
  }[];
};

function inquiry(overrides: Overrides = {}) {
  return {
    id: "i1",
    channel: "WEBSITE",
    status: InquiryStatus.OPEN,
    language: "en" as const,
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerPhone: "0712345678",
    assignedAgent: null,
    escalatedAt: null,
    createdAt: "2026-07-18T12:00:00.000Z",
    updatedAt: "2026-07-18T13:00:00.000Z",
    messages: [
      {
        id: "m1",
        sender: "CUSTOMER" as const,
        body: "Do you have rice in stock?",
        createdAt: "2026-07-18T12:00:00.000Z",
        author: null,
      },
    ],
    ...overrides,
  };
}

const agents = [
  { id: "u1", name: "Alex Agent", role: Role.AGENT },
  { id: "u2", name: "Robin Admin", role: Role.ADMIN },
];

function renderPage() {
  renderWithQuery(
    <MemoryRouter initialEntries={["/admin/inquiries/i1"]}>
      <Routes>
        <Route path="/admin/inquiries/:id" element={<InquiryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockDetail(data: ReturnType<typeof inquiry>) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/api/users") return Promise.resolve({ data: { users: agents } });
    return Promise.resolve({ data: { inquiry: data } });
  });
}

describe("InquiryDetailPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("fetches the inquiry by id and renders customer info and the thread", async () => {
    mockDetail(inquiry());
    renderPage();

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith("/api/inquiries/i1");
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("0712345678")).toBeInTheDocument();
    expect(screen.getByText("Do you have rice in stock?")).toBeInTheDocument();
  });

  it("shows the agent name under staff messages", async () => {
    mockDetail(
      inquiry({
        messages: [
          {
            id: "m1",
            sender: "STAFF",
            body: "Yes, in stock!",
            createdAt: "2026-07-18T12:30:00.000Z",
            author: { id: "u1", name: "Alex Agent" },
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("Yes, in stock!")).toBeInTheDocument();
    expect(screen.getByText(/Alex Agent/)).toBeInTheDocument();
  });

  it("shows the customer's language and defaults the reply box to left-to-right", async () => {
    mockDetail(inquiry({ language: "en" }));
    renderPage();

    expect(await screen.findByText("English")).toBeInTheDocument();
    const textbox = await screen.findByLabelText("Reply", { exact: true });
    expect(textbox).toHaveAttribute("dir", "ltr");
    expect(textbox).toHaveAttribute("lang", "en");
  });

  it("shows Arabic and renders the reply box right-to-left", async () => {
    mockDetail(inquiry({ language: "ar" }));
    renderPage();

    expect(await screen.findByText("Arabic")).toBeInTheDocument();
    const textbox = await screen.findByLabelText("Reply", { exact: true });
    expect(textbox).toHaveAttribute("dir", "rtl");
    expect(textbox).toHaveAttribute("lang", "ar");
  });

  it("renders a not-found state on 404", async () => {
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedGet.mockImplementation((url: string) => {
      if (url === "/api/users") return Promise.resolve({ data: { users: agents } });
      return Promise.reject(
        new AxiosError("Not found", undefined, undefined, undefined, {
          status: 404,
          statusText: "Not Found",
          data: { error: "Inquiry not found" },
          headers: {},
          config: { headers: new AxiosHeaders() },
        }),
      );
    });
    renderPage();

    expect(await screen.findByText("Inquiry not found.")).toBeInTheDocument();
  });

  it("claims the inquiry and refetches", async () => {
    mockedGet
      .mockImplementationOnce(() => Promise.resolve({ data: { inquiry: inquiry() } }))
      .mockImplementationOnce(() => Promise.resolve({ data: { users: agents } }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: { inquiry: inquiry({ assignedAgent: { id: "u1", name: "Alex Agent" } }) },
        }),
      );
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Claim" }));

    expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/claim");
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(3));
  });

  it("sends a reply and clears the input", async () => {
    mockDetail(inquiry());
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    const textbox = await screen.findByLabelText("Reply");
    await userEvent.type(textbox, "Yes, we have plenty in stock");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/messages", {
        message: "Yes, we have plenty in stock",
      }),
    );
  });

  it("hides the reply box when the inquiry is closed", async () => {
    mockDetail(inquiry({ status: InquiryStatus.CLOSED }));
    renderPage();

    expect(await screen.findByText("This conversation is closed.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Reply")).not.toBeInTheDocument();
  });

  it("assigns the inquiry to the selected agent", async () => {
    mockedGet
      .mockImplementationOnce(() => Promise.resolve({ data: { inquiry: inquiry() } }))
      .mockImplementationOnce(() => Promise.resolve({ data: { users: agents } }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: { inquiry: inquiry({ assignedAgent: { id: "u1", name: "Alex Agent" } }) },
        }),
      );
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    await screen.findByText("Jane Doe");
    await userEvent.click(screen.getByRole("combobox", { name: "Assigned to" }));
    await userEvent.click(await screen.findByRole("option", { name: "Alex Agent" }));

    expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/assign", { agentId: "u1" });
  });

  it("only offers admins in the escalate dropdown", async () => {
    mockDetail(inquiry());
    renderPage();

    await screen.findByText("Jane Doe");
    await userEvent.click(screen.getByRole("combobox", { name: "Escalation" }));

    expect(await screen.findByRole("option", { name: "Robin Admin" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alex Agent" })).not.toBeInTheDocument();
  });

  it("escalates the inquiry to the selected admin", async () => {
    mockedGet
      .mockImplementationOnce(() => Promise.resolve({ data: { inquiry: inquiry() } }))
      .mockImplementationOnce(() => Promise.resolve({ data: { users: agents } }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            inquiry: inquiry({
              assignedAgent: { id: "u2", name: "Robin Admin" },
              escalatedAt: "2026-07-20T10:00:00.000Z",
            }),
          },
        }),
      );
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    await screen.findByText("Jane Doe");
    await userEvent.click(screen.getByRole("combobox", { name: "Escalation" }));
    await userEvent.click(await screen.findByRole("option", { name: "Robin Admin" }));

    expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/escalate", { agentId: "u2" });
    expect(await screen.findByText(/Escalated/)).toBeInTheDocument();
  });

  it("hides the escalate control once already escalated", async () => {
    mockDetail(inquiry({ escalatedAt: "2026-07-20T10:00:00.000Z" }));
    renderPage();

    expect(await screen.findByText(/Escalated/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Escalation" })).not.toBeInTheDocument();
  });

  it("hides the escalate control when the inquiry is closed", async () => {
    mockDetail(inquiry({ status: InquiryStatus.CLOSED }));
    renderPage();

    await screen.findByText("Jane Doe");
    expect(screen.queryByText("Escalation")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Escalation" })).not.toBeInTheDocument();
  });
});
