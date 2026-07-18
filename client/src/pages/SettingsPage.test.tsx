import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import SettingsPage from "./SettingsPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), put: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPut = vi.mocked(axios.put);

describe("SettingsPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPut.mockReset();
  });

  it("loads the current settings into the form", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { settings: { deliveryFee: 200, freeDeliveryThreshold: 5000 } },
    });
    renderWithQuery(<SettingsPage />);

    await waitFor(() => expect(screen.getByLabelText("Delivery fee")).toHaveValue(200));
    expect(screen.getByLabelText("Free delivery threshold")).toHaveValue(5000);
  });

  it("saves updated settings", async () => {
    mockedGet.mockResolvedValue({
      data: { settings: { deliveryFee: 200, freeDeliveryThreshold: null } },
    });
    mockedPut.mockResolvedValueOnce({
      data: { settings: { deliveryFee: 300, freeDeliveryThreshold: 4000 } },
    });
    renderWithQuery(<SettingsPage />);

    // Wait for the fetched values to fill the form before editing.
    await waitFor(() => expect(screen.getByLabelText("Delivery fee")).toHaveValue(200));
    const feeInput = screen.getByLabelText("Delivery fee");
    await userEvent.clear(feeInput);
    await userEvent.type(feeInput, "300");
    await userEvent.type(screen.getByLabelText("Free delivery threshold"), "4000");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith("/api/settings", {
        deliveryFee: 300,
        freeDeliveryThreshold: 4000,
      }),
    );
    expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
  });

  it("rejects a negative delivery fee client-side", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { settings: { deliveryFee: 0, freeDeliveryThreshold: null } },
    });
    renderWithQuery(<SettingsPage />);

    const feeInput = await screen.findByLabelText("Delivery fee");
    await userEvent.clear(feeInput);
    await userEvent.type(feeInput, "-5");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(
      await screen.findByText("Delivery fee must be zero or a positive whole number"),
    ).toBeInTheDocument();
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it("shows an error when loading fails", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network error"));
    renderWithQuery(<SettingsPage />);

    expect(
      await screen.findByText("Could not load settings. Please try again."),
    ).toBeInTheDocument();
  });
});
