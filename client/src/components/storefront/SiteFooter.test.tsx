import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import SiteFooter from "./SiteFooter";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);

function renderFooter() {
  renderWithQuery(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  );
}

describe("SiteFooter", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      data: {
        settings: {
          deliveryFee: 0,
          freeDeliveryThreshold: null,
          contactPhone: null,
          contactEmail: null,
          contactAddress: null,
        },
      },
    });
    await i18n.changeLanguage("en");
  });

  it("renders the brand link pointing to the storefront root", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Halatu" })).toHaveAttribute("href", "/");
  });

  it("renders nav links to the existing storefront routes", () => {
    renderFooter();
    const nav = screen.getByRole("navigation", { name: "Footer navigation" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  });

  it("renders the copyright line with the current year", () => {
    renderFooter();
    const year = new Date().getFullYear();
    expect(
      screen.getByText(`© ${year} Halatu. All rights reserved.`),
    ).toBeInTheDocument();
  });

  it("shows a skeleton placeholder while settings are loading, not a layout jump", () => {
    mockedGet.mockReset();
    mockedGet.mockReturnValue(new Promise(() => {})); // never resolves
    renderFooter();

    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
    expect(screen.queryByRole("link", { name: /^\+/ })).not.toBeInTheDocument();
  });

  it("hides contact info entirely when nothing is configured", async () => {
    renderFooter();
    expect(await screen.findByRole("navigation", { name: "Footer navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^\+/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });

  it("renders configured contact info as actionable links", async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      data: {
        settings: {
          deliveryFee: 0,
          freeDeliveryThreshold: null,
          contactPhone: "+255 700 123 456",
          contactEmail: "hello@es-market.co.tz",
          contactAddress: "12 Market Street, City Center",
        },
      },
    });
    renderFooter();

    expect(
      await screen.findByRole("link", { name: "+255 700 123 456" }),
    ).toHaveAttribute("href", "tel:+255700123456");
    expect(screen.getByRole("link", { name: "hello@es-market.co.tz" })).toHaveAttribute(
      "href",
      "mailto:hello@es-market.co.tz",
    );
    expect(
      screen.getByRole("link", { name: "12 Market Street, City Center" }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=12%20Market%20Street%2C%20City%20Center",
    );
  });
});
