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
    mockedGet.mockResolvedValueOnce({ data: { count: 0 } });
    renderLayout();

    const link = await screen.findByRole("link", { name: "Inquiries" });
    expect(link).toHaveAttribute("href", "/admin/inquiries");
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith("/api/inquiries/attention-count"));
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("shows a badge with the attention count when inquiries need attention", async () => {
    mockedGet.mockResolvedValueOnce({ data: { count: 3 } });
    renderLayout();

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(
      screen.getByLabelText("3 inquiries need attention"),
    ).toBeInTheDocument();
  });

  it("hides ADMIN-only nav links for an AGENT", async () => {
    mockedGet.mockResolvedValueOnce({ data: { count: 0 } });
    renderLayout({ role: Role.AGENT });

    await screen.findByRole("link", { name: "Inquiries" });
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Products" })).not.toBeInTheDocument();
  });
});
