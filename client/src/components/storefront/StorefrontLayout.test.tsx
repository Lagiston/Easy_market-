import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, it, expect, beforeEach } from "vitest";
import i18n from "@/i18n";
import StorefrontLayout from "./StorefrontLayout";

function renderLayout() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<StorefrontLayout />}>
          <Route index element={<div>Page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("StorefrontLayout", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("renders the brand link pointing to the storefront root", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "ES-Market" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders a nav link to the products page", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("renders the language switcher", () => {
    renderLayout();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders the child route content in the outlet", () => {
    renderLayout();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });
});
