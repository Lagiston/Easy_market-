import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import HomePage from "./HomePage";

// ScrollFrameAnimation preloads 270 `new Image()` frames on every mount (its
// real scroll-scrubbed hero) — none of these tests exercise that animation
// itself (see the component's own file for why it's manual-only, not even
// E2E-tested), and constructing that many Images on every one of this file's
// many HomePage renders is expensive enough under full-suite parallel load
// to blow through findByText/test timeouts elsewhere in this file (seen
// live: the category-tile tests below intermittently time out only when the
// whole suite runs together, never in isolation). Stub it down to just
// rendering its slotted content — every assertion in this file reads from
// `children`/`endChildren`/`pillarsChildren`, never the canvas/preload
// internals, so nothing here loses coverage.
vi.mock("@/components/storefront/ScrollFrameAnimation", () => ({
  ScrollFrameAnimation: ({
    children,
    endChildren,
    pillarsChildren,
  }: {
    children?: ReactNode;
    endChildren?: ReactNode;
    pillarsChildren?: ReactNode[];
  }) => (
    <>
      {children}
      {endChildren}
      {pillarsChildren}
    </>
  ),
}));

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

// axios.get is now called with two distinct storefront URLs (promo-blocks,
// categories) — a blanket mockResolvedValue can no longer serve both, so
// each test's setup keys the response by URL.
function mockStorefrontData({
  promoBlocks = [],
  categories = [],
}: {
  promoBlocks?: unknown[];
  categories?: unknown[];
} = {}) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/api/storefront/promo-blocks") {
      return Promise.resolve({ data: { promoBlocks } });
    }
    if (url === "/api/storefront/categories") {
      return Promise.resolve({ data: { categories } });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

describe("storefront HomePage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    mockedGet.mockReset();
    mockStorefrontData();
    await i18n.changeLanguage("en");
  });

  it("renders the hero with a CTA linking to the product list", async () => {
    renderPage();

    expect(screen.getByText("HALATU")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: /serve looks.*head to toe/i });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText("Wigs, makeup, fashion, and fine details — everything to turn heads."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shop collection/i })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("renders the 'Our story' card and its three pillars", async () => {
    renderPage();

    expect(await screen.findByText("OUR STORY")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "For people who choose to stand out, not blend in."),
    ).toBeInTheDocument();
    expect(screen.getByText("One brand")).toBeInTheDocument();
    expect(screen.getByText("Every category")).toBeInTheDocument();
    expect(screen.getByText("Infinite ways to wear it")).toBeInTheDocument();
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
      "/track",
    );
    expect(screen.getByRole("link", { name: "Free pickup" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("plays the background video muted, looped, and autoplaying, with a CTA falling back to the unfiltered product list when no Makeup category exists", async () => {
    renderPage();

    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(screen.getByRole("link", { name: /explore beauty/i })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("points the editorial banner CTA at the Makeup category when one exists", async () => {
    mockStorefrontData({
      categories: [
        { id: "cat-makeup", name: { en: "Makeup" }, imageUrl: null, homeRow: "look_good", itemCount: 5 },
      ],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /explore beauty/i })).toHaveAttribute(
        "href",
        "/products?category=cat-makeup",
      );
    });
  });

  it("does not autoplay the background video when prefers-reduced-motion is set", async () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );

    renderPage();

    const video = document.querySelector("video");
    expect(video?.autoplay).toBe(false);

    matchMediaSpy.mockRestore();
  });

  it("renders translated content in Arabic", async () => {
    await i18n.changeLanguage("ar");
    renderPage();

    expect(screen.getByText("الدفع عند الاستلام")).toBeInTheDocument();
  });

  it("renders no promo section when there are no active promo blocks", async () => {
    mockStorefrontData({ promoBlocks: [] });
    renderPage();

    await screen.findByRole("heading", { name: /serve looks.*head to toe/i });
    expect(mockedGet).toHaveBeenCalledWith("/api/storefront/promo-blocks");
    expect(screen.queryByRole("link", { name: /shop now/i })).not.toBeInTheDocument();
  });

  it("renders active promo blocks with a headline, copy, and internal CTA link", async () => {
    mockStorefrontData({
      promoBlocks: [
        {
          id: "promo1",
          headline: { en: "Summer Sale" },
          copy: { en: "20% off all beverages" },
          ctaLabel: "Shop now",
          ctaUrl: "/products?tag=sale",
        },
      ],
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
    mockStorefrontData({
      promoBlocks: [
        {
          id: "promo1",
          headline: { en: "Partner offer" },
          copy: null,
          ctaLabel: "Learn more",
          ctaUrl: "https://example.com/offer",
        },
      ],
    });
    renderPage();

    const link = await screen.findByRole("link", { name: "Learn more" });
    expect(link).toHaveAttribute("href", "https://example.com/offer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders a promo block with no CTA", async () => {
    mockStorefrontData({
      promoBlocks: [
        { id: "promo1", headline: { en: "Announcement" }, copy: null, ctaLabel: null, ctaUrl: null },
      ],
    });
    renderPage();

    expect(await screen.findByText("Announcement")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /learn more|shop now/i })).not.toBeInTheDocument();
  });

  const LOOK_GOOD_CATEGORY = {
    id: "cat-wigs",
    name: { en: "Wigs" },
    imageUrl: null,
    homeRow: "look_good",
    itemCount: 3,
  };
  const LOOK_GOOD_CATEGORY_WITH_IMAGE = {
    id: "cat-makeup",
    name: { en: "Makeup" },
    imageUrl: "/api/uploads/categories/makeup.jpg",
    homeRow: "look_good",
    itemCount: 5,
  };
  const HOME_EVERYDAY_CATEGORY = {
    id: "cat-groceries",
    name: { en: "Groceries" },
    imageUrl: "/api/uploads/categories/groceries.jpg",
    homeRow: "home_everyday",
    itemCount: 16,
  };

  it("renders no category section when there are no homepage categories", async () => {
    mockStorefrontData({ categories: [] });
    renderPage();

    await screen.findByRole("heading", { name: /serve looks.*head to toe/i });
    expect(screen.queryByText("Look Good")).not.toBeInTheDocument();
  });

  it("renders only the Look Good row with correct tiles, counts, and links — not Home & Everyday categories", async () => {
    mockStorefrontData({ categories: [LOOK_GOOD_CATEGORY, HOME_EVERYDAY_CATEGORY] });
    renderPage();

    expect(await screen.findByText("Look Good")).toBeInTheDocument();
    expect(screen.getByText("Wigs")).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Browse Wigs, 3 items" })).toHaveAttribute(
      "href",
      "/products?category=cat-wigs",
    );

    expect(screen.queryByText("Home & Everyday")).not.toBeInTheDocument();
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
  });

  it("excludes a Look Good category with zero items from the row", async () => {
    // CategoryBrowseSection.tsx filters on `itemCount > 0` (not just
    // `homeRow === "look_good"`) — an empty category shouldn't be offered as
    // something to browse. With only a zero-item category available, the
    // whole row (and its "Look Good" kicker) should be absent entirely.
    const emptyLookGoodCategory = { ...LOOK_GOOD_CATEGORY, itemCount: 0 };
    mockStorefrontData({ categories: [emptyLookGoodCategory] });
    renderPage();

    await screen.findByRole("heading", { name: /serve looks.*head to toe/i });
    expect(screen.queryByText("Look Good")).not.toBeInTheDocument();
    expect(screen.queryByText("Wigs")).not.toBeInTheDocument();
  });

  it("reverses the API's newest-first order back to seeded (oldest-first) order", async () => {
    // /api/storefront/categories returns createdAt desc — Makeup (seeded
    // after Wigs) comes first in the raw response, so the component must
    // reverse it to render Wigs before Makeup.
    mockStorefrontData({ categories: [LOOK_GOOD_CATEGORY_WITH_IMAGE, LOOK_GOOD_CATEGORY] });
    renderPage();

    await screen.findByText("Wigs");
    const names = screen
      .getAllByText(/^(Wigs|Makeup)$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["Wigs", "Makeup"]);
  });

  it("shows a placeholder circle when a category has no image, and a photo when it does", async () => {
    mockStorefrontData({ categories: [LOOK_GOOD_CATEGORY, LOOK_GOOD_CATEGORY_WITH_IMAGE] });
    renderPage();

    await screen.findByText("Wigs");
    // Tile photos are decorative (alt=""), so they don't have an accessible
    // "img" role — query the DOM directly instead. Scoped to uploaded
    // category images specifically, since OurStorySection also renders its
    // own (unrelated) decorative photo on this page.
    const images = document.querySelectorAll('img[src^="/api/uploads/categories/"]');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", "/api/uploads/categories/makeup.jpg");
  });
});
