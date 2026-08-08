import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import HomePage from "./HomePage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);

function renderPage() {
  renderWithQuery(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("storefront HomePage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: { promoBlocks: [] } });
    await i18n.changeLanguage("en");
  });

  it("renders the hero with a CTA linking to the product list", async () => {
    renderPage();

    expect(screen.getByText("Geyafa")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: /serve looks.*head to toe/i });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText("Wigs, makeup, fashion, and fine details — everything to turn heads."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shop the collection/i })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("renders the three feature highlights", async () => {
    renderPage();

    expect(screen.getByText("Pay on delivery")).toBeInTheDocument();
    expect(screen.getByText("Fast city delivery")).toBeInTheDocument();
    expect(screen.getByText("Free pickup")).toBeInTheDocument();
  });

  it("links each feature card to its destination page", async () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Pay on delivery" })).toHaveAttribute(
      "href",
      "/checkout",
    );
    expect(screen.getByRole("link", { name: "Fast city delivery" })).toHaveAttribute(
      "href",
      "/order-status",
    );
    expect(screen.getByRole("link", { name: "Free pickup" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("renders translated content in Arabic", async () => {
    await i18n.changeLanguage("ar");
    renderPage();

    expect(screen.getByText("الدفع عند الاستلام")).toBeInTheDocument();
  });

  it("renders no promo section when there are no active promo blocks", async () => {
    mockedGet.mockResolvedValue({ data: { promoBlocks: [] } });
    renderPage();

    await screen.findByRole("heading", { name: /serve looks.*head to toe/i });
    expect(mockedGet).toHaveBeenCalledWith("/api/storefront/promo-blocks");
    expect(screen.queryByRole("link", { name: /shop now/i })).not.toBeInTheDocument();
  });

  it("renders active promo blocks with a headline, copy, and internal CTA link", async () => {
    mockedGet.mockResolvedValue({
      data: {
        promoBlocks: [
          {
            id: "promo1",
            headline: { en: "Summer Sale" },
            copy: { en: "20% off all beverages" },
            ctaLabel: "Shop now",
            ctaUrl: "/products?tag=sale",
          },
        ],
      },
    });
    renderPage();

    expect(await screen.findByText("Summer Sale")).toBeInTheDocument();
    expect(screen.getByText("20% off all beverages")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop now" })).toHaveAttribute(
      "href",
      "/products?tag=sale",
    );
  });

  it("renders an external CTA as a new-tab anchor", async () => {
    mockedGet.mockResolvedValue({
      data: {
        promoBlocks: [
          {
            id: "promo1",
            headline: { en: "Partner offer" },
            copy: null,
            ctaLabel: "Learn more",
            ctaUrl: "https://example.com/offer",
          },
        ],
      },
    });
    renderPage();

    const link = await screen.findByRole("link", { name: "Learn more" });
    expect(link).toHaveAttribute("href", "https://example.com/offer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders a promo block with no CTA", async () => {
    mockedGet.mockResolvedValue({
      data: {
        promoBlocks: [
          { id: "promo1", headline: { en: "Announcement" }, copy: null, ctaLabel: null, ctaUrl: null },
        ],
      },
    });
    renderPage();

    expect(await screen.findByText("Announcement")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /learn more|shop now/i })).not.toBeInTheDocument();
  });
});
