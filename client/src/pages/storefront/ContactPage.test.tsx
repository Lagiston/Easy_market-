import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import i18n from "@/i18n";
import ContactPage from "./ContactPage";

describe("storefront ContactPage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("renders phone and email as actionable links", () => {
    render(<ContactPage />);

    expect(screen.getByRole("link", { name: "+255 700 000 000" })).toHaveAttribute(
      "href",
      "tel:+255700000000",
    );
    expect(screen.getByRole("link", { name: "hello@es-market.example" })).toHaveAttribute(
      "href",
      "mailto:hello@es-market.example",
    );
  });

  it("renders address and opening hours", () => {
    render(<ContactPage />);

    expect(screen.getByText("12 Market Street, City Center")).toBeInTheDocument();
    expect(screen.getByText("Mon–Sat: 8:00–20:00, Sun: 9:00–14:00")).toBeInTheDocument();
  });

  it("renders translated labels in Arabic", async () => {
    await i18n.changeLanguage("ar");
    render(<ContactPage />);

    expect(screen.getByRole("heading", { name: "اتصل بنا" })).toBeInTheDocument();
    expect(screen.getByText("الهاتف")).toBeInTheDocument();
    expect(screen.getByText("شارع السوق 12، وسط المدينة")).toBeInTheDocument();
  });
});
