import "@/i18n";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import PromoBlocksPage from "./PromoBlocksPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const promoBlocks = [
  {
    id: "p1",
    headline: { en: "Summer Sale" },
    copy: { en: "20% off all beverages" },
    ctaLabel: "Shop now",
    ctaUrl: "/products?tag=sale",
    isActive: true,
    startsAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-08-05T23:59:59.999Z",
    sortOrder: 0,
  },
  {
    id: "p2",
    headline: { en: "New arrivals" },
    copy: null,
    ctaLabel: null,
    ctaUrl: null,
    isActive: false,
    startsAt: null,
    endsAt: null,
    sortOrder: 1,
  },
];

function renderPage() {
  renderWithQuery(<PromoBlocksPage />);
}

describe("PromoBlocksPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("Storefront homepage promotions")).toBeInTheDocument();
    expect(screen.queryByText("Summer Sale")).not.toBeInTheDocument();
  });

  it("renders promo blocks once loaded, with effective live/inactive status", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        // p1 unscheduled here (rather than the module fixture's fixed Aug
        // 1-5 window) so this assertion is Live regardless of the real
        // current date the test happens to run on.
        promoBlocks: [{ ...promoBlocks[0], startsAt: null, endsAt: null }, promoBlocks[1]],
      },
    });
    renderPage();

    expect(await screen.findByText("Summer Sale")).toBeInTheDocument();
    expect(screen.getByText("Shop now")).toBeInTheDocument();
    expect(screen.getByText("New arrivals")).toBeInTheDocument();
    // p1: isActive, no schedule set → Live regardless of the current date.
    expect(screen.getByText("Live")).toBeInTheDocument();
    // p2: isActive false, no schedule → Inactive regardless of date.
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(await screen.findByText("2 blocks")).toBeInTheDocument();
  });

  it("shows the date range in the Schedule column for a scheduled promo block", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        promoBlocks: [
          { ...promoBlocks[0], startsAt: "2026-08-01T00:00:00.000Z", endsAt: "2026-08-05T23:59:59.999Z" },
        ],
      },
    });
    renderPage();

    expect(await screen.findByText("Summer Sale")).toBeInTheDocument();
    expect(screen.getByText(/2026.*–.*2026/)).toBeInTheDocument();
  });

  it("shows Scheduled for an active promo block whose start date hasn't arrived yet", async () => {
    // A start date far enough in the future to never be "reached" during a
    // real test run, so this doesn't depend on (or need to fake) the clock.
    mockedAxios.get.mockResolvedValue({
      data: { promoBlocks: [{ ...promoBlocks[0], startsAt: "2099-01-01T00:00:00.000Z" }] },
    });
    renderPage();

    expect(await screen.findByText("Summer Sale")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("shows Expired for an active promo block whose end date has passed", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        promoBlocks: [
          { ...promoBlocks[0], startsAt: null, endsAt: "2000-01-01T00:00:00.000Z" },
        ],
      },
    });
    renderPage();

    expect(await screen.findByText("Summer Sale")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("network"));
    renderPage();

    expect(
      await screen.findByText("Could not load promo blocks. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("creates a promo block with headline, CTA, and active toggle, then closes the dialog", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks: [] } });
    mockedAxios.post.mockResolvedValue({
      data: {
        promoBlock: {
          id: "p3",
          headline: { en: "Flash Deal" },
          copy: undefined,
          ctaLabel: "Buy now",
          ctaUrl: "/products",
          isActive: true,
          sortOrder: 0,
        },
      },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Storefront homepage promotions");

    await user.click(screen.getByRole("button", { name: "Create promo block" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Headline (English)"), "Flash Deal");
    await user.type(screen.getByLabelText("CTA label"), "Buy now");
    await user.type(screen.getByLabelText("CTA link"), "https://example.com/deal");

    await user.click(within(dialog).getByRole("button", { name: "Create promo block" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/promo-blocks",
        expect.objectContaining({
          headline: { en: "Flash Deal" },
          ctaLabel: "Buy now",
          ctaUrl: "https://example.com/deal",
          isActive: true,
          sortOrder: 0,
        }),
      ),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("creates a promo block with a start and end date", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks: [] } });
    mockedAxios.post.mockResolvedValue({
      data: { promoBlock: { ...promoBlocks[0], id: "p3", headline: { en: "Scheduled Promo" } } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Storefront homepage promotions");

    await user.click(screen.getByRole("button", { name: "Create promo block" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Headline (English)"), "Scheduled Promo");
    // jsdom doesn't support simulating keyboard segment entry into a native
    // date input, so set the value directly (same fireEvent.change escape
    // hatch this repo already uses for inputs userEvent can't drive reliably).
    fireEvent.change(within(dialog).getByLabelText("Start date"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("End date"), {
      target: { value: "2026-08-05" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Create promo block" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/promo-blocks",
        expect.objectContaining({
          startsAt: new Date("2026-08-01T00:00:00.000Z"),
          // Inclusive of the whole end day, per promoBlockSchema's transform.
          endsAt: new Date("2026-08-05T23:59:59.999Z"),
        }),
      ),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("rejects an end date before the start date", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks: [] } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Storefront homepage promotions");

    await user.click(screen.getByRole("button", { name: "Create promo block" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Headline (English)"), "Backwards Promo");
    fireEvent.change(within(dialog).getByLabelText("Start date"), {
      target: { value: "2026-08-05" },
    });
    fireEvent.change(within(dialog).getByLabelText("End date"), {
      target: { value: "2026-08-01" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Create promo block" }));

    expect(
      await screen.findByText("End date must be on or after the start date"),
    ).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("pre-fills the start and end date when editing a scheduled promo block", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Summer Sale");

    await user.click(screen.getByRole("button", { name: "Edit Summer Sale" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Start date")).toHaveValue("2026-08-01");
    expect(within(dialog).getByLabelText("End date")).toHaveValue("2026-08-05");
  });

  it("rejects a CTA label with no CTA link", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks: [] } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Storefront homepage promotions");

    await user.click(screen.getByRole("button", { name: "Create promo block" }));
    await user.type(screen.getByLabelText("Headline (English)"), "Flash Deal");
    await user.type(screen.getByLabelText("CTA label"), "Buy now");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Create promo block" }));

    expect(
      await screen.findByText("A CTA link is required when a CTA label is set"),
    ).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("opens the edit dialog pre-filled and saves changes", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks } });
    mockedAxios.put.mockResolvedValue({
      data: { promoBlock: { ...promoBlocks[0], headline: { en: "Summer Mega Sale" } } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Summer Sale");

    await user.click(screen.getByRole("button", { name: "Edit Summer Sale" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Headline (English)")).toHaveValue("Summer Sale");
    expect(within(dialog).getByLabelText("CTA label")).toHaveValue("Shop now");

    const headlineInput = within(dialog).getByLabelText("Headline (English)");
    await user.clear(headlineInput);
    await user.type(headlineInput, "Summer Mega Sale");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith(
        "/api/promo-blocks/p1",
        expect.objectContaining({ headline: { en: "Summer Mega Sale" } }),
      ),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("opens the delete confirmation and removes the promo block on confirm", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks } });
    mockedAxios.delete.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Summer Sale");

    await user.click(screen.getByRole("button", { name: "Delete Summer Sale" }));
    expect(await screen.findByText("Delete Summer Sale?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedAxios.delete).toHaveBeenCalledWith("/api/promo-blocks/p1"));
  });
});
