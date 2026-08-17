import "@/i18n";
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

const baseSettings = {
  siteName: "Halatu",
  deliveryFee: 200,
  freeDeliveryThreshold: 5000,
  callAttemptsBeforeCancel: 3,
  defaultLowStockThreshold: 10,
  contactPhone: "+255 700 123 456",
  contactEmail: "hello@es-market.co.tz",
  contactAddress: "12 Market Street, City Center",
  socialInstagramUrl: null,
  socialTiktokUrl: null,
  socialFacebookUrl: null,
  socialWhatsappUrl: null,
};

describe("SettingsPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPut.mockReset();
  });

  it("loads the current settings into the form", async () => {
    mockedGet.mockResolvedValueOnce({ data: { settings: baseSettings } });
    renderWithQuery(<SettingsPage />);

    await waitFor(() => expect(screen.getByLabelText("Delivery fee")).toHaveValue(200));
    expect(screen.getByLabelText("Free delivery threshold")).toHaveValue(5000);
    expect(screen.getByLabelText("Failed call attempts before cancel offer")).toHaveValue(3);
    expect(screen.getByLabelText("Default low stock threshold")).toHaveValue(10);
    expect(screen.getByLabelText("Contact phone")).toHaveValue("+255 700 123 456");
    expect(screen.getByLabelText("Contact email")).toHaveValue("hello@es-market.co.tz");
    expect(screen.getByLabelText("Contact address")).toHaveValue("12 Market Street, City Center");
  });

  it("saves updated settings", async () => {
    mockedGet.mockResolvedValue({
      data: { settings: { ...baseSettings, freeDeliveryThreshold: null } },
    });
    mockedPut.mockResolvedValueOnce({
      data: { settings: { ...baseSettings, deliveryFee: 300, freeDeliveryThreshold: 4000 } },
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
        siteName: "Halatu",
        deliveryFee: 300,
        freeDeliveryThreshold: 4000,
        callAttemptsBeforeCancel: 3,
        defaultLowStockThreshold: 10,
        contactPhone: "+255 700 123 456",
        contactEmail: "hello@es-market.co.tz",
        contactAddress: "12 Market Street, City Center",
      }),
    );
    expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
  });

  it("rejects a negative delivery fee client-side", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { settings: { ...baseSettings, deliveryFee: 0, freeDeliveryThreshold: null } },
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

  it("rejects a call-attempts value below 1 client-side", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { settings: { ...baseSettings, deliveryFee: 0, freeDeliveryThreshold: null } },
    });
    renderWithQuery(<SettingsPage />);

    // Wait for the fetched values to fill the form before editing (otherwise
    // the async `values` sync can clobber an edit made before the fetch settles).
    const callAttemptsInput = screen.getByLabelText("Failed call attempts before cancel offer");
    await waitFor(() => expect(callAttemptsInput).toHaveValue(3));
    await userEvent.clear(callAttemptsInput);
    await userEvent.type(callAttemptsInput, "0");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(
      await screen.findByText("Call attempts before cancel must be a whole number of at least 1"),
    ).toBeInTheDocument();
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it("rejects an invalid contact email client-side", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { settings: { ...baseSettings, deliveryFee: 0, freeDeliveryThreshold: null } },
    });
    renderWithQuery(<SettingsPage />);

    const emailInput = screen.getByLabelText("Contact email");
    await waitFor(() => expect(emailInput).toHaveValue("hello@es-market.co.tz"));
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it("clears an optional contact field back to blank", async () => {
    mockedGet.mockResolvedValueOnce({ data: { settings: baseSettings } });
    mockedPut.mockResolvedValueOnce({
      data: { settings: { ...baseSettings, contactPhone: null } },
    });
    renderWithQuery(<SettingsPage />);

    const phoneInput = screen.getByLabelText("Contact phone");
    await waitFor(() => expect(phoneInput).toHaveValue("+255 700 123 456"));
    await userEvent.clear(phoneInput);
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(mockedPut).toHaveBeenCalled());
    const [, body] = mockedPut.mock.calls[0]!;
    expect((body as { contactPhone?: string }).contactPhone).toBeUndefined();
  });

  it("loads configured social links into the form", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        settings: {
          ...baseSettings,
          socialInstagramUrl: "https://instagram.com/halatu",
          socialTiktokUrl: "https://tiktok.com/@halatu",
          socialFacebookUrl: "https://facebook.com/halatu",
          socialWhatsappUrl: "https://wa.me/255700123456",
        },
      },
    });
    renderWithQuery(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("Instagram URL")).toHaveValue("https://instagram.com/halatu"),
    );
    expect(screen.getByLabelText("TikTok URL")).toHaveValue("https://tiktok.com/@halatu");
    expect(screen.getByLabelText("Facebook URL")).toHaveValue("https://facebook.com/halatu");
    expect(screen.getByLabelText("WhatsApp URL")).toHaveValue("https://wa.me/255700123456");
  });

  it("saves a newly entered Instagram URL", async () => {
    mockedGet.mockResolvedValue({ data: { settings: baseSettings } });
    mockedPut.mockResolvedValueOnce({
      data: { settings: { ...baseSettings, socialInstagramUrl: "https://instagram.com/halatu" } },
    });
    renderWithQuery(<SettingsPage />);

    const instagramInput = await screen.findByLabelText("Instagram URL");
    await userEvent.type(instagramInput, "https://instagram.com/halatu");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({ socialInstagramUrl: "https://instagram.com/halatu" }),
      ),
    );
  });

  it("rejects an invalid social URL client-side", async () => {
    mockedGet.mockResolvedValueOnce({ data: { settings: baseSettings } });
    renderWithQuery(<SettingsPage />);

    const instagramInput = await screen.findByLabelText("Instagram URL");
    await userEvent.type(instagramInput, "not-a-url");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(
      await screen.findByText("Enter a valid link (starting with http:// or https://)"),
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
