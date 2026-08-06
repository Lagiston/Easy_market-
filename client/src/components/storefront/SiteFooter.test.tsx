import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, beforeEach } from "vitest";
import i18n from "@/i18n";
import SiteFooter from "./SiteFooter";

function renderFooter() {
  render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  );
}

describe("SiteFooter", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders the brand link pointing to the storefront root", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "ES-Market" })).toHaveAttribute("href", "/");
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
      screen.getByText(`© ${year} ES-Market. All rights reserved.`),
    ).toBeInTheDocument();
  });
});
