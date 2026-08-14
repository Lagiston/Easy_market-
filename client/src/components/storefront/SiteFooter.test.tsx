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
          socialInstagramUrl: null,
          socialTiktokUrl: null,
          socialFacebookUrl: null,
          socialWhatsappUrl: null,
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

    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /\+/ })).not.toBeInTheDocument();
  });

  it("hides contact buttons entirely when nothing is configured", async () => {
    renderFooter();
    expect(await screen.findByRole("navigation", { name: "Footer navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /\+/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });

  it("renders configured phone/email as actionable buttons and the address on its own line", async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      data: {
        settings: {
          deliveryFee: 0,
          freeDeliveryThreshold: null,
          contactPhone: "+255 700 123 456",
          contactEmail: "hello@es-market.co.tz",
          contactAddress: "12 Market Street, City Center",
          socialInstagramUrl: null,
          socialTiktokUrl: null,
          socialFacebookUrl: null,
          socialWhatsappUrl: null,
        },
      },
    });
    renderFooter();

    expect(
      await screen.findByRole("link", { name: /\+255 700 123 456/ }),
    ).toHaveAttribute("href", "tel:+255700123456");
    expect(screen.getByRole("link", { name: /hello@es-market\.co\.tz/ })).toHaveAttribute(
      "href",
      "mailto:hello@es-market.co.tz",
    );
    expect(screen.getByText("12 Market Street, City Center")).toBeInTheDocument();
  });

  it("renders the mission statement", () => {
    renderFooter();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent ===
            "Practical hardware and building supplies for Dar es Salaam — sourced honestly, priced fairly, delivered on time.",
      ),
    ).toBeInTheDocument();
  });

  it("hides all social links when nothing is configured", async () => {
    renderFooter();
    expect(await screen.findByRole("navigation", { name: "Footer navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "instagram" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "tiktok" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "facebook" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "whatsapp" })).not.toBeInTheDocument();
  });

  it("renders configured Instagram, TikTok, and Facebook social links", async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      data: {
        settings: {
          deliveryFee: 0,
          freeDeliveryThreshold: null,
          contactPhone: null,
          contactEmail: null,
          contactAddress: null,
          socialInstagramUrl: "https://instagram.com/halatu",
          socialTiktokUrl: "https://tiktok.com/@halatu",
          socialFacebookUrl: "https://facebook.com/halatu",
          socialWhatsappUrl: null,
        },
      },
    });
    renderFooter();

    expect(await screen.findByRole("link", { name: "instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com/halatu",
    );
    expect(screen.getByRole("link", { name: "tiktok" })).toHaveAttribute(
      "href",
      "https://tiktok.com/@halatu",
    );
    expect(screen.getByRole("link", { name: "facebook" })).toHaveAttribute(
      "href",
      "https://facebook.com/halatu",
    );
    expect(screen.queryByRole("link", { name: "whatsapp" })).not.toBeInTheDocument();
  });

  it("adds a WhatsApp social link derived from the configured contact phone", async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      data: {
        settings: {
          deliveryFee: 0,
          freeDeliveryThreshold: null,
          contactPhone: "+255 700 123 456",
          contactEmail: null,
          contactAddress: null,
          socialInstagramUrl: null,
          socialTiktokUrl: null,
          socialFacebookUrl: null,
          socialWhatsappUrl: null,
        },
      },
    });
    renderFooter();

    expect(await screen.findByRole("link", { name: "whatsapp" })).toHaveAttribute(
      "href",
      "https://wa.me/255700123456",
    );
  });

  it("prefers a configured WhatsApp URL over the one derived from contact phone", async () => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({
      data: {
        settings: {
          deliveryFee: 0,
          freeDeliveryThreshold: null,
          contactPhone: "+255 700 123 456",
          contactEmail: null,
          contactAddress: null,
          socialInstagramUrl: null,
          socialTiktokUrl: null,
          socialFacebookUrl: null,
          socialWhatsappUrl: "https://wa.me/255700123456?text=Hi",
        },
      },
    });
    renderFooter();

    expect(await screen.findByRole("link", { name: "whatsapp" })).toHaveAttribute(
      "href",
      "https://wa.me/255700123456?text=Hi",
    );
  });
});
