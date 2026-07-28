import { screen, waitFor, within } from "@testing-library/react";
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
    sortOrder: 0,
  },
  {
    id: "p2",
    headline: { en: "New arrivals" },
    copy: null,
    ctaLabel: null,
    ctaUrl: null,
    isActive: false,
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

  it("renders promo blocks once loaded, with active/inactive status", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks } });
    renderPage();

    expect(await screen.findByText("Summer Sale")).toBeInTheDocument();
    expect(screen.getByText("Shop now")).toBeInTheDocument();
    expect(screen.getByText("New arrivals")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(await screen.findByText("2 blocks")).toBeInTheDocument();
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
    await user.type(screen.getByLabelText("Headline"), "Flash Deal");
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

  it("rejects a CTA label with no CTA link", async () => {
    mockedAxios.get.mockResolvedValue({ data: { promoBlocks: [] } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Storefront homepage promotions");

    await user.click(screen.getByRole("button", { name: "Create promo block" }));
    await user.type(screen.getByLabelText("Headline"), "Flash Deal");
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
    expect(within(dialog).getByLabelText("Headline")).toHaveValue("Summer Sale");
    expect(within(dialog).getByLabelText("CTA label")).toHaveValue("Shop now");

    const headlineInput = within(dialog).getByLabelText("Headline");
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
