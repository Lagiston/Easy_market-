import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import HomePage from "./HomePage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

describe("HomePage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("shows a skeleton while checking server health", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<HomePage />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.queryByText(/server is up and running/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/server is unreachable/i)).not.toBeInTheDocument();
  });

  it("shows an ok message when the server is healthy", async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: "ok" } });

    renderWithQuery(<HomePage />);

    expect(await screen.findByText(/server is up and running/i)).toBeInTheDocument();
  });

  it("shows an error message when the server reports a non-ok status", async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: "degraded" } });

    renderWithQuery(<HomePage />);

    expect(await screen.findByText(/server is unreachable/i)).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    renderWithQuery(<HomePage />);

    await waitFor(() =>
      expect(screen.getByText(/server is unreachable/i)).toBeInTheDocument(),
    );
  });
});
