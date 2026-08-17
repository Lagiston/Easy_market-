import "@/i18n";
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import { Role } from "@es-market/core";
import type { SessionUser } from "@/lib/auth-client";
import Layout from "./Layout";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);

// Layout now also fetches /api/settings (for the site name in the brand
// link) alongside /api/inquiries/attention-count — mock by URL rather than
// call order so the two queries' request order can't make a test flaky.
function mockAttentionCount(count: number) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/api/settings") {
      return Promise.resolve({ data: { settings: { siteName: "Halatu" } } });
    }
    if (url === "/api/inquiries/attention-count") {
      return Promise.resolve({ data: { count } });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "u1",
    name: "Admin",
    email: "admin@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: Role.ADMIN,
    ...overrides,
  } as SessionUser;
}

function renderLayout(overrides: Partial<SessionUser> = {}) {
  renderWithQuery(
    <MemoryRouter>
      <Layout user={user(overrides)} />
    </MemoryRouter>,
  );
}

describe("Layout", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("renders the Inquiries nav link without a badge when nothing needs attention", async () => {
    mockAttentionCount(0);
    renderLayout();

    const link = await screen.findByRole("link", { name: "Inquiries" });
    expect(link).toHaveAttribute("href", "/admin/inquiries");
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith("/api/inquiries/attention-count"));
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("shows a badge with the attention count when inquiries need attention", async () => {
    mockAttentionCount(3);
    renderLayout();

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(
      screen.getByLabelText("3 inquiries need attention"),
    ).toBeInTheDocument();
  });

  it("hides ADMIN-only nav links for an AGENT", async () => {
    mockAttentionCount(0);
    renderLayout({ role: Role.AGENT });

    await screen.findByRole("link", { name: "Inquiries" });
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Products" })).not.toBeInTheDocument();
  });
});
