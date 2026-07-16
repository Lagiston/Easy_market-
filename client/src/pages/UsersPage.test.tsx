import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import UsersPage from "./UsersPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const users = [
  {
    id: "1",
    name: "Ada Lovelace",
    email: "ada@es-market.test",
    role: "ADMIN" as const,
    emailVerified: true,
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Grace Hopper",
    email: "grace@es-market.test",
    role: "AGENT" as const,
    emailVerified: false,
    createdAt: "2026-02-14T00:00:00.000Z",
  },
];

describe("UsersPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("shows skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<UsersPage />);

    expect(screen.getByText("Staff accounts")).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("renders users once loaded", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });

    renderWithQuery(<UsersPage />);

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@es-market.test")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();

    expect(screen.getByLabelText("Verified")).toBeInTheDocument();
    expect(screen.getByLabelText("Not verified")).toBeInTheDocument();

    expect(await screen.findByText("2 members")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    renderWithQuery(<UsersPage />);

    await waitFor(() =>
      expect(
        screen.getByText("Could not load users. Please try again."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
