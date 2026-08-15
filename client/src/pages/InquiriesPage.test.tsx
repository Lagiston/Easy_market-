import "@/i18n";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import { InquiryStatus } from "@es-market/core";
import type { InquiryRow } from "@/components/InquiriesTable";
import InquiriesPage from "./InquiriesPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);

function inquiry(overrides: Partial<InquiryRow> = {}): InquiryRow {
  return {
    id: "i1",
    channel: "WEBSITE",
    status: InquiryStatus.OPEN,
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerPhone: null,
    topic: null,
    assignedAgent: null,
    escalatedAt: null,
    autoResolvedAt: null,
    createdAt: "2026-07-18T12:00:00.000Z",
    updatedAt: "2026-07-18T12:00:00.000Z",
    ...overrides,
  };
}

function renderPage(initialEntries: string[] = ["/"]) {
  return renderWithQuery(
    <MemoryRouter initialEntries={initialEntries}>
      <InquiriesPage />
    </MemoryRouter>,
  );
}

describe("InquiriesPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("renders inquiry rows with customer, status, and assignee", async () => {
    mockedGet.mockResolvedValueOnce({ data: { inquiries: [inquiry()] } });
    renderPage();

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Open")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Unassigned")).toBeInTheDocument();
  });

  it("links each customer name to the detail page", async () => {
    mockedGet.mockResolvedValueOnce({ data: { inquiries: [inquiry()] } });
    renderPage();

    expect(await screen.findByRole("link", { name: "Jane Doe" })).toHaveAttribute(
      "href",
      "/admin/inquiries/i1",
    );
  });

  it("shows an empty state when there are no inquiries", async () => {
    mockedGet.mockResolvedValueOnce({ data: { inquiries: [] } });
    renderPage();

    expect(await screen.findByText("No inquiries yet.")).toBeInTheDocument();
  });

  it("defaults to the all queue and refetches on queue tab click", async () => {
    mockedGet.mockResolvedValue({ data: { inquiries: [] } });
    renderPage();

    await screen.findByText("No inquiries yet.");
    expect(mockedGet).toHaveBeenCalledWith("/api/inquiries", { params: { queue: "all" } });

    await userEvent.click(screen.getByRole("tab", { name: "My queue" }));

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith("/api/inquiries", { params: { queue: "mine" } }),
    );
  });

  it("combines the queue and status filters in the query params", async () => {
    mockedGet.mockResolvedValue({ data: { inquiries: [] } });
    renderPage();

    await screen.findByText("No inquiries yet.");
    await userEvent.click(screen.getByRole("tab", { name: "Unassigned" }));
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Resolved" }));

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith("/api/inquiries", {
        params: { queue: "unassigned", status: InquiryStatus.RESOLVED },
      }),
    );
  });

  it("pre-filters by queue and status from incoming query params (dashboard deep link)", async () => {
    mockedGet.mockResolvedValue({ data: { inquiries: [] } });
    renderPage(["/?queue=unassigned&status=OPEN"]);

    await screen.findByText("No inquiries yet.");
    expect(mockedGet).toHaveBeenCalledWith("/api/inquiries", {
      params: { queue: "unassigned", status: InquiryStatus.OPEN },
    });
    expect(screen.getByRole("tab", { name: "Unassigned" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("ignores invalid queue/status query params and falls back to defaults", async () => {
    mockedGet.mockResolvedValue({ data: { inquiries: [] } });
    renderPage(["/?queue=bogus&status=BOGUS"]);

    await screen.findByText("No inquiries yet.");
    expect(mockedGet).toHaveBeenCalledWith("/api/inquiries", { params: { queue: "all" } });
  });

  it("claims an unassigned inquiry and refetches", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { inquiries: [inquiry()] } })
      .mockResolvedValueOnce({
        data: {
          inquiries: [inquiry({ assignedAgent: { id: "u1", name: "Alex Agent" } })],
        },
      });
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    await userEvent.click(await screen.findByLabelText("Claim inquiry from Jane Doe"));

    expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/claim");
    expect(await screen.findByText("Alex Agent")).toBeInTheDocument();
  });

  it("resolves an open inquiry and refetches", async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { inquiries: [inquiry()] } })
      .mockResolvedValueOnce({
        data: { inquiries: [inquiry({ status: InquiryStatus.RESOLVED })] },
      });
    mockedPost.mockResolvedValueOnce({ data: {} });
    renderPage();

    await userEvent.click(await screen.findByLabelText("Resolve inquiry from Jane Doe"));

    expect(mockedPost).toHaveBeenCalledWith("/api/inquiries/i1/resolve");
    expect(await within(screen.getByRole("table")).findByText("Resolved")).toBeInTheDocument();
  });

  it("only offers claim on unassigned inquiries", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        inquiries: [
          inquiry({ id: "i1", customerName: "Jane Doe" }),
          inquiry({
            id: "i2",
            customerName: "Sam Smith",
            assignedAgent: { id: "u1", name: "Alex Agent" },
          }),
        ],
      },
    });
    renderPage();

    expect(await screen.findByLabelText("Claim inquiry from Jane Doe")).toBeInTheDocument();
    expect(screen.queryByLabelText("Claim inquiry from Sam Smith")).not.toBeInTheDocument();
  });

  it("shows the escalated warning icon only on escalated inquiries", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        inquiries: [
          inquiry({ id: "i1", customerName: "Jane Doe", escalatedAt: null }),
          inquiry({
            id: "i2",
            customerName: "Sam Smith",
            escalatedAt: "2026-07-20T10:00:00.000Z",
          }),
        ],
      },
    });
    renderPage();

    await screen.findByText("Jane Doe");
    const rows = screen.getAllByRole("row");
    const janeRow = rows.find((row) => within(row).queryByText("Jane Doe"))!;
    const samRow = rows.find((row) => within(row).queryByText("Sam Smith"))!;
    expect(within(samRow).getByRole("img", { name: "Escalated" })).toBeInTheDocument();
    expect(within(janeRow).queryByRole("img", { name: "Escalated" })).not.toBeInTheDocument();
  });

  it("only offers reopen on resolved or closed inquiries", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        inquiries: [
          inquiry({ id: "i1", customerName: "Jane Doe", status: InquiryStatus.OPEN }),
          inquiry({ id: "i2", customerName: "Sam Smith", status: InquiryStatus.CLOSED }),
        ],
      },
    });
    renderPage();

    expect(await screen.findByLabelText("Reopen inquiry from Sam Smith")).toBeInTheDocument();
    expect(screen.queryByLabelText("Reopen inquiry from Jane Doe")).not.toBeInTheDocument();
  });

  it("surfaces a server error when an action fails", async () => {
    mockedGet.mockResolvedValue({ data: { inquiries: [inquiry()] } });
    const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    mockedPost.mockRejectedValueOnce(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        data: { error: "This inquiry has already been claimed" },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByLabelText("Claim inquiry from Jane Doe"));

    expect(
      await screen.findByText("This inquiry has already been claimed"),
    ).toBeInTheDocument();
  });
});
