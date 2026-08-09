import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "./HomePage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: vi.fn() },
}));

import { authClient } from "@/lib/auth-client";
const mockedUseSession = vi.mocked(authClient.useSession);

const stats = {
  products: 3,
  orders: 12,
  lowStock: 1,
  openInquiries: 4,
  escalatedInquiries: 2,
  draftSuccessRate: 82,
  categorySuggestionAcceptanceRate: 67,
  tagSuggestionAcceptanceRate: 38,
};

function adminSession() {
  return { data: { user: { role: "ADMIN" } } } as unknown as ReturnType<
    typeof authClient.useSession
  >;
}

function agentSession() {
  return { data: { user: { role: "AGENT" } } } as unknown as ReturnType<
    typeof authClient.useSession
  >;
}

function mockGet(overrides: Record<string, unknown> = {}) {
  mockedAxios.get.mockImplementation(
    (url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === "/api/dashboard/stats") {
        return Promise.resolve({ data: { stats: overrides.stats ?? stats } });
      }
      if (url === "/api/orders") {
        return Promise.resolve({ data: { orders: overrides.orders ?? [] } });
      }
      if (url === "/api/inquiries") {
        const queue = config?.params?.queue;
        return Promise.resolve({
          data: {
            inquiries:
              (queue === "mine" ? overrides.myInquiries : overrides.openInquiries) ?? [],
          },
        });
      }
      if (url === "/api/products") {
        return Promise.resolve({ data: { products: overrides.products ?? [] } });
      }
      if (url === "/api/reviews") {
        return Promise.resolve({ data: { reviews: overrides.reviews ?? [] } });
      }
      if (url === "/api/dashboard/most-wishlisted") {
        return Promise.resolve({ data: { products: overrides.mostWishlisted ?? [] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    },
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("shows the KPI row for an admin", async () => {
    mockedUseSession.mockReturnValue(adminSession());
    mockGet();

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Products")).toBeInTheDocument();
    const productsTile = screen.getByText("Products").closest("[data-slot=stat-card]")!;
    expect(await within(productsTile as HTMLElement).findByText("3")).toBeInTheDocument();
  });

  it("hides the KPI row for an agent", async () => {
    mockedUseSession.mockReturnValue(agentSession());
    mockGet();

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await screen.findByText("My queue");
    expect(screen.queryByText("Products")).not.toBeInTheDocument();
    expect(mockedAxios.get).not.toHaveBeenCalledWith(
      "/api/dashboard/stats",
      expect.anything(),
    );
  });

  it("lists orders awaiting confirmation", async () => {
    mockedUseSession.mockReturnValue(agentSession());
    mockGet({
      orders: [
        {
          id: "o1",
          code: "ABC123",
          status: "RECEIVED",
          customerName: "Jane Doe",
          callAttempts: 2,
          createdAt: "2026-07-20T00:00:00.000Z",
        },
      ],
    });

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText("2/3 calls")).toBeInTheDocument();
  });

  it("shows an error toast when confirming an order fails", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(agentSession());
    mockGet({
      orders: [
        {
          id: "o1",
          code: "ABC123",
          status: "RECEIVED",
          customerName: "Jane Doe",
          callAttempts: 0,
          createdAt: "2026-07-20T00:00:00.000Z",
        },
      ],
    });
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: "Order already confirmed" } },
    });
    mockedAxios.isAxiosError.mockReturnValueOnce(true);

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
        <Toaster />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Order already confirmed")).toBeInTheDocument();
  });

  it("shows an error toast when claiming an inquiry fails", async () => {
    const user = userEvent.setup();
    mockedUseSession.mockReturnValue(agentSession());
    mockGet({
      openInquiries: [
        {
          id: "i1",
          customerName: "Unassigned Customer",
          assignedAgent: null,
          escalatedAt: null,
          status: "OPEN",
        },
      ],
    });
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: "Inquiry already claimed" } },
    });
    mockedAxios.isAxiosError.mockReturnValueOnce(true);

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
        <Toaster />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Claim" }));

    expect(await screen.findByText("Inquiry already claimed")).toBeInTheDocument();
  });

  it("shows empty state when nothing needs attention", async () => {
    mockedUseSession.mockReturnValue(agentSession());
    mockGet();

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No orders waiting on a call.")).toBeInTheDocument();
    expect(screen.getByText("Nothing unassigned.")).toBeInTheDocument();
    expect(screen.getByText("Nothing escalated.")).toBeInTheDocument();
    expect(screen.getByText("Nothing in your queue.")).toBeInTheDocument();
  });

  it("splits open inquiries into unassigned and escalated buckets", async () => {
    mockedUseSession.mockReturnValue(agentSession());
    mockGet({
      openInquiries: [
        {
          id: "i1",
          customerName: "Unassigned Customer",
          assignedAgent: null,
          escalatedAt: null,
          status: "OPEN",
        },
        {
          id: "i2",
          customerName: "Escalated Customer",
          assignedAgent: { id: "u1", name: "Agent Smith" },
          escalatedAt: "2026-07-21T00:00:00.000Z",
          status: "OPEN",
        },
      ],
    });

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Unassigned Customer")).toBeInTheDocument();
      expect(screen.getByText("Escalated Customer")).toBeInTheDocument();
    });
  });

  it("shows low-stock products for an admin, excluding in-stock and out-of-stock items", async () => {
    mockedUseSession.mockReturnValue(adminSession());
    mockGet({
      products: [
        {
          id: "p1",
          name: { en: "Low Stock Item" },
          stock: 2,
          lowStockThreshold: 10,
          category: { id: "c1", name: { en: "Groceries" } },
        },
        {
          id: "p2",
          name: { en: "In Stock Item" },
          stock: 20,
          lowStockThreshold: 10,
          category: { id: "c1", name: { en: "Groceries" } },
        },
        {
          id: "p3",
          name: { en: "Out Of Stock Item" },
          stock: 0,
          lowStockThreshold: 10,
          category: { id: "c1", name: { en: "Groceries" } },
        },
      ],
    });

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Low Stock Item")).toBeInTheDocument();
    expect(screen.getByText("2 left")).toBeInTheDocument();
    expect(screen.queryByText("In Stock Item")).not.toBeInTheDocument();
    expect(screen.queryByText("Out Of Stock Item")).not.toBeInTheDocument();
  });

  it("shows low-rated reviews needing a reply for an admin, excluding already-replied ones", async () => {
    mockedUseSession.mockReturnValue(adminSession());
    mockGet({
      reviews: [
        {
          id: "r1",
          authorName: "Unhappy Customer",
          rating: 1,
          staffReply: null,
          product: { id: "p1", name: { en: "Sour Milk" } },
        },
        {
          id: "r2",
          authorName: "Already Handled",
          rating: 2,
          staffReply: "Sorry about that!",
          product: { id: "p2", name: { en: "Bad Bread" } },
        },
        {
          id: "r3",
          authorName: "Happy Customer",
          rating: 5,
          staffReply: null,
          product: { id: "p3", name: { en: "Great Rice" } },
        },
      ],
    });

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Sour Milk")).toBeInTheDocument();
    expect(screen.getByText("by Unhappy Customer")).toBeInTheDocument();
    expect(screen.queryByText("Bad Bread")).not.toBeInTheDocument();
    expect(screen.queryByText("Great Rice")).not.toBeInTheDocument();
    const statTile = screen.getByText("Reviews needing a reply").closest("[data-slot=stat-card]")!;
    expect(await within(statTile as HTMLElement).findByText("1")).toBeInTheDocument();
  });

  it("shows the empty state when no low-rated reviews need a reply", async () => {
    mockedUseSession.mockReturnValue(adminSession());
    mockGet();

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nothing needs a reply.")).toBeInTheDocument();
  });

  it("shows the most wishlisted products for an admin, ranked as returned by the server", async () => {
    mockedUseSession.mockReturnValue(adminSession());
    mockGet({
      mostWishlisted: [
        { id: "p1", name: "Popular Rice", wishlistCount: 8 },
        { id: "p2", name: "Trendy Juice", wishlistCount: 3 },
      ],
    });

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const popularRow = (await screen.findByText("Popular Rice")).closest("a")!;
    expect(within(popularRow).getByText("8")).toBeInTheDocument();
    const trendyRow = screen.getByText("Trendy Juice").closest("a")!;
    expect(within(trendyRow).getByText("3")).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/dashboard/most-wishlisted");
  });

  it("shows the empty state when nothing has been wishlisted yet", async () => {
    mockedUseSession.mockReturnValue(adminSession());
    mockGet();

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nothing wishlisted yet.")).toBeInTheDocument();
  });

  it("hides the most-wishlisted card for an agent", async () => {
    mockedUseSession.mockReturnValue(agentSession());
    mockGet();

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await screen.findByText("My queue");
    expect(screen.queryByText("Most wishlisted products")).not.toBeInTheDocument();
    expect(mockedAxios.get).not.toHaveBeenCalledWith("/api/dashboard/most-wishlisted");
  });

  it("hides the low-stock card for an agent", async () => {
    mockedUseSession.mockReturnValue(agentSession());
    mockGet();

    renderWithQuery(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await screen.findByText("My queue");
    expect(screen.queryByText("Low-stock products")).not.toBeInTheDocument();
    expect(mockedAxios.get).not.toHaveBeenCalledWith("/api/products", expect.anything());
  });
});
