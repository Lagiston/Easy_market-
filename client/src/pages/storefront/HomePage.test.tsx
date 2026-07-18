import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import HomePage from "./HomePage";

function renderPage() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("storefront HomePage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("renders the hero with a CTA linking to the product list", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Welcome to ES-Market" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("renders the three feature highlights", () => {
    renderPage();

    expect(screen.getByText("Pay on delivery")).toBeInTheDocument();
    expect(screen.getByText("Fast city delivery")).toBeInTheDocument();
    expect(screen.getByText("Free pickup")).toBeInTheDocument();
  });

  it("renders translated content in Arabic", async () => {
    await i18n.changeLanguage("ar");
    renderPage();

    expect(
      screen.getByRole("heading", { name: "مرحبًا بكم في إي إس ماركت" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "تصفح المنتجات" })).toBeInTheDocument();
  });
});
