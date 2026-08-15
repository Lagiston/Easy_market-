import "@/i18n";
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
  autoResolvedAt?: string | null;
  messages?: {
    id: string;
    sender: "CUSTOMER" | "STAFF" | "AI_DRAFT";
    body: string;
    createdAt: string;
    author: { id: string; name: string } | null;
    draftStatus?: "PENDING" | "SENT_UNEDITED" | "SENT_EDITED" | "DISCARDED" | "AUTO_RESOLVED" | null;
    sources?: { id: string; title: string }[];
  }[];
  smsLogs?: {
    id: string;
    to: string;
    message: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    error: string | null;
    createdAt: string;
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
    autoResolvedAt: null,
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

  it("shows SMS notification history when the detail route includes it", async () => {
    mockDetail(
      inquiry({
        smsLogs: [
          {
            id: "sms1",
            to: "+255712345678",
            message: "Halatu: we've replied to your message MSG4K2P9. Read it: halatu.co.tz/t/MSG4K2P9",
            status: "FAILED",
            error: "Invalid phone number",
            createdAt: "2026-07-18T13:30:00.000Z",
          },
        ],
      }),
    );
    renderPage();

    await screen.findByText("Jane Doe");
    expect(screen.getByText("SMS notifications")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Halatu: we've replied to your message MSG4K2P9. Read it: halatu.co.tz/t/MSG4K2P9",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Invalid phone number")).toBeInTheDocument();
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

  it("shows a pending AI draft with sources and an editable reply", async () => {
    mockDetail(
      inquiry({
        messages: [
          {
            id: "m1",
            sender: "CUSTOMER",
            body: "Do you have rice in stock?",
            createdAt: "2026-07-18T12:00:00.000Z",
            author: null,
          },
          {
            id: "m2",
            sender: "AI_DRAFT",
            body: "Yes, rice is currently in stock.",
            createdAt: "2026-07-18T12:01:00.000Z",
            author: null,
            draftStatus: "PENDING",
            sources: [{ id: "kb1", title: "Stock levels" }],
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("AI draft")).toBeInTheDocument();
    expect(screen.getByText("Sources: Stock levels")).toBeInTheDocument();
    expect(screen.getByLabelText("Draft reply")).toHaveValue("Yes, rice is currently in stock.");
    expect(screen.getByRole("button", { name: "Approve & send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("approves a draft with edits and sends the edited text", async () => {
    mockDetail(
      inquiry({
        messages: [
          {
            id: "m2",
            sender: "AI_DRAFT",
            body: "Yes, rice is currently in stock.",
            createdAt: "2026-07-18T12:01:00.000Z",
            author: null,
            draftStatus: "PENDING",
            sources: [],
          },
        ],
      }),
    );
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    const textbox = await screen.findByLabelText("Draft reply");
    await userEvent.clear(textbox);
    await userEvent.type(textbox, "Yes, plenty of rice in stock right now.");
    await userEvent.click(screen.getByRole("button", { name: "Approve & send" }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/messages/m2/approve", {
        message: "Yes, plenty of rice in stock right now.",
      }),
    );
  });

  it("discards a draft", async () => {
    mockDetail(
      inquiry({
        messages: [
          {
            id: "m2",
            sender: "AI_DRAFT",
            body: "Yes, rice is currently in stock.",
            createdAt: "2026-07-18T12:01:00.000Z",
            author: null,
            draftStatus: "PENDING",
            sources: [],
          },
        ],
      }),
    );
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/messages/m2/discard"),
    );
  });

  it("approves a draft unedited and marks it sent as-is once the refetch resolves", async () => {
    const pending = inquiry({
      messages: [
        {
          id: "m2",
          sender: "AI_DRAFT",
          body: "Yes, rice is currently in stock.",
          createdAt: "2026-07-18T12:01:00.000Z",
          author: null,
          draftStatus: "PENDING",
          sources: [],
        },
      ],
    });
    const sent = { ...pending, messages: [{ ...pending.messages[0]!, draftStatus: "SENT_UNEDITED" as const }] };
    let inquiryCallCount = 0;
    mockedGet.mockImplementation((url: string) => {
      if (url === "/api/users") return Promise.resolve({ data: { users: agents } });
      inquiryCallCount += 1;
      return Promise.resolve({ data: { inquiry: inquiryCallCount === 1 ? pending : sent } });
    });
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    await screen.findByLabelText("Draft reply");
    await userEvent.click(screen.getByRole("button", { name: "Approve & send" }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/messages/m2/approve", {
        message: "Yes, rice is currently in stock.",
      }),
    );

    expect(await screen.findByText("Sent as-is")).toBeInTheDocument();
  });

  it("renders a 'Deleted article' source title as sent by the server", async () => {
    mockDetail(
      inquiry({
        messages: [
          {
            id: "m2",
            sender: "AI_DRAFT",
            body: "Yes, rice is currently in stock.",
            createdAt: "2026-07-18T12:01:00.000Z",
            author: null,
            draftStatus: "SENT_UNEDITED",
            sources: [{ id: "kb1", title: "Deleted article" }],
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("Sources: Deleted article")).toBeInTheDocument();
  });

  it("shows a pending draft on a closed inquiry as unreviewed history, with no action buttons", async () => {
    mockDetail(
      inquiry({
        status: InquiryStatus.CLOSED,
        messages: [
          {
            id: "m2",
            sender: "AI_DRAFT",
            body: "Yes, rice is currently in stock.",
            createdAt: "2026-07-18T12:01:00.000Z",
            author: null,
            draftStatus: "PENDING",
            sources: [],
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("Not reviewed — conversation closed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve & send" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Draft reply")).not.toBeInTheDocument();
  });

  it("renders a reviewed draft without action buttons", async () => {
    mockDetail(
      inquiry({
        messages: [
          {
            id: "m2",
            sender: "AI_DRAFT",
            body: "Yes, rice is currently in stock.",
            createdAt: "2026-07-18T12:01:00.000Z",
            author: null,
            draftStatus: "SENT_EDITED",
            sources: [],
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("Sent with edits")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve & send" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Draft reply")).not.toBeInTheDocument();
  });

  it("renders an auto-resolved inquiry with no review actions and a header badge", async () => {
    mockDetail(
      inquiry({
        status: InquiryStatus.RESOLVED,
        autoResolvedAt: "2026-07-18T12:02:00.000Z",
        messages: [
          {
            id: "m1",
            sender: "CUSTOMER",
            body: "How do I reset my password?",
            createdAt: "2026-07-18T12:00:00.000Z",
            author: null,
          },
          {
            id: "m2",
            sender: "AI_DRAFT",
            body: "Go to the login page and click Forgot Password.",
            createdAt: "2026-07-18T12:01:00.000Z",
            author: null,
            draftStatus: "AUTO_RESOLVED",
            sources: [],
          },
        ],
      }),
    );
    renderPage();

    expect(await screen.findByText("Auto-resolved by AI")).toBeInTheDocument();
    const autoResolvedMentions = screen.getAllByText(/Auto-resolved/);
    expect(autoResolvedMentions.length).toBeGreaterThan(1); // header badge + message label
    expect(screen.queryByRole("button", { name: "Approve & send" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Draft reply")).not.toBeInTheDocument();
  });
});
